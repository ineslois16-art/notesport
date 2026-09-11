import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as db from '../db/database';
import {
  buildSchedule,
  computeTotals,
  DEFAULT_SETTINGS,
  emptyDay,
  clockToMinutes,
  entryFor,
  normalizeSettings,
  nowClock,
  type BlockEntry,
  type DayRecord,
  type DayTotals,
  type Effort,
  type PlannedBlock,
  type Settings,
} from '../domain/program';
import { todayISO, type ISODate } from '../lib/dates';
import { syncReminders } from '../lib/reminders';

const META_DEBOUNCE_MS = 700;

type StoreValue = {
  ready: boolean;
  error: string | null;
  settings: Settings;
  date: ISODate;
  day: DayRecord;
  schedule: PlannedBlock[];
  totals: DayTotals;
  /** Incrémenté à chaque écriture : les écrans d'analyse s'en servent pour se rafraîchir. */
  revision: number;
  setDate: (date: ISODate) => void;
  toggleBlock: (blockId: string) => Promise<void>;
  setBlockEffort: (blockId: string, patch: Partial<Effort>) => Promise<void>;
  setBlockTime: (blockId: string, time: string | null) => Promise<void>;
  resetBlock: (blockId: string) => Promise<void>;
  setDayMeta: (patch: { weight?: number | null; notes?: string }) => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [date, setDateState] = useState<ISODate>(todayISO());
  const [day, setDay] = useState<DayRecord>(() => emptyDay(todayISO()));
  const [revision, setRevision] = useState(0);

  const pendingMeta = useRef<{ date: ISODate; weight: number | null; notes: string } | null>(null);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback(() => setRevision((value) => value + 1), []);

  const flushMeta = useCallback(async () => {
    if (metaTimer.current) {
      clearTimeout(metaTimer.current);
      metaTimer.current = null;
    }
    const pending = pendingMeta.current;
    if (!pending) return;
    pendingMeta.current = null;
    await db.saveDayMeta(pending.date, pending.weight, pending.notes);
    await db.pruneDay(pending.date);
    bump();
  }, [bump]);

  const loadDay = useCallback(async (target: ISODate) => {
    const record = await db.readDay(target);
    if (record) {
      setDay(record);
      return;
    }
    // Nouvelle journée : on reprend le dernier poids connu pour ne pas
    // repartir d'une valeur par défaut à chaque fois.
    const weight = await db.readLastKnownWeight(target);
    setDay(emptyDay(target, weight));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await db.readSettings();
        const today = todayISO();
        if (cancelled) return;
        setSettings(stored);
        setDateState(today);
        await loadDay(today);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Impossible d'ouvrir la base locale.");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDay]);

  const setDate = useCallback(
    (next: ISODate) => {
      void flushMeta().then(() => {
        setDateState(next);
        return loadDay(next);
      });
    },
    [flushMeta, loadDay],
  );

  const writeEntry = useCallback(
    async (entry: BlockEntry) => {
      setDay((previous) => ({ ...previous, blocks: { ...previous.blocks, [entry.blockId]: entry } }));
      await db.saveBlockEntry(date, entry);
      await db.pruneDay(date);
      bump();
    },
    [bump, date],
  );

  const schedule = useMemo(() => buildSchedule(settings), [settings]);

  const blockById = useCallback(
    (blockId: string) => schedule.find((block) => block.id === blockId) ?? null,
    [schedule],
  );

  const toggleBlock = useCallback(
    async (blockId: string) => {
      const block = blockById(blockId);
      if (!block) return;
      const entry = entryFor(day, block);
      const done = !entry.done;
      // Cocher un bloc du jour l'horodate à la minute, sauf heure déjà saisie.
      const time = done && !entry.time && date === todayISO() ? nowClock() : entry.time;
      await writeEntry({ ...entry, done, touched: true, time });
    },
    [blockById, date, day, writeEntry],
  );

  const setBlockTime = useCallback(
    async (blockId: string, time: string | null) => {
      const block = blockById(blockId);
      if (!block) return;
      const entry = entryFor(day, block);
      await writeEntry({
        ...entry,
        touched: true,
        time: time && clockToMinutes(time) !== null ? time : null,
      });
    },
    [blockById, day, writeEntry],
  );

  const setBlockEffort = useCallback(
    async (blockId: string, patch: Partial<Effort>) => {
      const block = blockById(blockId);
      if (!block) return;
      const entry = entryFor(day, block);
      const clamp = (value: number) => Math.max(0, Math.min(9999, Math.round(value)));
      await writeEntry({
        ...entry,
        touched: true,
        jumps: clamp(patch.jumps ?? entry.jumps),
        pushups: clamp(patch.pushups ?? entry.pushups),
        squats: clamp(patch.squats ?? entry.squats),
      });
    },
    [blockById, day, writeEntry],
  );

  const resetBlock = useCallback(
    async (blockId: string) => {
      const block = blockById(blockId);
      if (!block) return;
      await writeEntry({
        blockId,
        done: false,
        touched: false,
        time: null,
        jumps: block.jumps,
        pushups: block.pushups,
        squats: block.squats,
      });
    },
    [blockById, writeEntry],
  );

  const setDayMeta = useCallback(
    (patch: { weight?: number | null; notes?: string }) => {
      setDay((previous) => {
        const next: DayRecord = {
          ...previous,
          weight: patch.weight !== undefined ? patch.weight : previous.weight,
          notes: patch.notes !== undefined ? patch.notes : previous.notes,
        };
        pendingMeta.current = { date: next.date, weight: next.weight, notes: next.notes };
        return next;
      });
      if (metaTimer.current) clearTimeout(metaTimer.current);
      metaTimer.current = setTimeout(() => {
        void flushMeta();
      }, META_DEBOUNCE_MS);
    },
    [flushMeta],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = normalizeSettings({ ...settings, ...patch });
      setSettings(next);
      await db.writeSettings(next);
      await syncReminders(next);
      bump();
    },
    [bump, settings],
  );

  const reload = useCallback(async () => {
    const stored = await db.readSettings();
    setSettings(stored);
    await loadDay(date);
    bump();
  }, [bump, date, loadDay]);

  // Écriture différée en attente au démontage : on la force pour ne rien perdre.
  useEffect(() => () => void flushMeta(), [flushMeta]);

  const totals = useMemo(() => computeTotals(day, settings), [day, settings]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      error,
      settings,
      date,
      day,
      schedule,
      totals,
      revision,
      setDate,
      toggleBlock,
      setBlockEffort,
      setBlockTime,
      resetBlock,
      setDayMeta,
      updateSettings,
      reload,
    }),
    [
      ready,
      error,
      settings,
      date,
      day,
      schedule,
      totals,
      revision,
      setDate,
      toggleBlock,
      setBlockEffort,
      setBlockTime,
      resetBlock,
      setDayMeta,
      updateSettings,
      reload,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore doit être utilisé à l’intérieur de <StoreProvider>.');
  return value;
}
