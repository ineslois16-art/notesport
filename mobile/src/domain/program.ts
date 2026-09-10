/**
 * Logique métier du programme : construction de la journée type, durées et
 * dépense énergétique. Volontairement pur (aucun accès à la base ni à React)
 * pour rester testable et réutilisable par tous les écrans.
 *
 * Les formules reprennent celles de la version web afin que l'historique
 * importé garde exactement les mêmes chiffres.
 */

import type { ISODate } from '../lib/dates';

export type Settings = {
  jumpsPerBlock: number;
  dailyJumpTarget: number;
  pushupsPerBlock: number;
  squatsPerBlock: number;
  startHour: number;
  intervalHours: number;
  blockCount: number;
  /** Cadence à la corde, en sauts par minute. */
  cadence: number;
  defaultWeight: number;
  remindersEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  jumpsPerBlock: 150,
  dailyJumpTarget: 1000,
  pushupsPerBlock: 20,
  squatsPerBlock: 20,
  startHour: 8,
  intervalHours: 2,
  blockCount: 7,
  cadence: 105,
  defaultWeight: 97,
  remindersEnabled: false,
};

export type PlannedBlock = {
  id: string;
  hour: number;
  label: string;
  jumps: number;
  pushups: number;
  squats: number;
};

export type Effort = {
  jumps: number;
  pushups: number;
  squats: number;
};

export type BlockEntry = Effort & {
  blockId: string;
  done: boolean;
  /** Vrai dès que la ligne a été touchée : évite de compter un bloc jamais ouvert. */
  touched: boolean;
};

export type DayRecord = {
  date: ISODate;
  weight: number | null;
  notes: string;
  blocks: Record<string, BlockEntry>;
};

export type DayTotals = {
  doneBlocks: number;
  blockCount: number;
  jumps: number;
  pushups: number;
  squats: number;
  kcal: number;
  seconds: number;
  targetJumps: number;
  percent: number;
};

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));

/** Ramène des réglages venus de la base ou d'un import dans des bornes utilisables. */
export function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  return {
    jumpsPerBlock: clampInt(s.jumpsPerBlock, 0, 5000),
    dailyJumpTarget: clampInt(s.dailyJumpTarget, 0, 50000),
    pushupsPerBlock: clampInt(s.pushupsPerBlock, 0, 1000),
    squatsPerBlock: clampInt(s.squatsPerBlock, 0, 1000),
    startHour: clampInt(s.startHour, 0, 23),
    intervalHours: clampInt(s.intervalHours, 1, 12),
    blockCount: clampInt(s.blockCount, 1, 24),
    cadence: clampInt(s.cadence, 30, 250),
    defaultWeight: Math.min(300, Math.max(20, Number(s.defaultWeight) || DEFAULT_SETTINGS.defaultWeight)),
    remindersEnabled: Boolean(s.remindersEnabled),
  };
}

/**
 * Répartit l'objectif quotidien sur les blocs : chaque bloc prend au plus
 * `jumpsPerBlock`, le dernier absorbe le reste (7 × 150 → 6 × 150 + 100 = 1 000).
 */
export function buildSchedule(settings: Settings): PlannedBlock[] {
  let remaining = settings.dailyJumpTarget;
  return Array.from({ length: settings.blockCount }, (_, index) => {
    const hour = (settings.startHour + index * settings.intervalHours) % 24;
    const jumps = Math.min(settings.jumpsPerBlock, Math.max(0, remaining));
    remaining -= jumps;
    return {
      id: String(index),
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      jumps,
      pushups: settings.pushupsPerBlock,
      squats: settings.squatsPerBlock,
    };
  });
}

export function describeEffort(effort: Effort): string {
  const parts = [
    effort.jumps > 0 ? `${effort.jumps} sauts` : null,
    effort.pushups > 0 ? `${effort.pushups} pompes` : null,
    effort.squats > 0 ? `${effort.squats} squats` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Repos';
}

/** Temps réellement en mouvement (hors récupération entre exercices). */
export function movementSeconds(effort: Effort, cadence: number): number {
  return (effort.jumps / Math.max(1, cadence)) * 60 + effort.pushups * 2 + effort.squats * 2;
}

/** Durée du bloc : mouvement + 1 min de transition entre deux exercices. */
export function blockSeconds(effort: Effort, cadence: number): number {
  const exercises = [effort.jumps, effort.pushups, effort.squats].filter((n) => n > 0).length;
  return movementSeconds(effort, cadence) + Math.max(0, exercises - 1) * 60;
}

/** Estimation MET : corde ~11.8, pompes ~3.8, squats ~5, récupération ~1.5. */
export function blockCalories(effort: Effort, weight: number, cadence: number): number {
  const jumpHours = effort.jumps / Math.max(1, cadence) / 60;
  const restHours = Math.max(0, blockSeconds(effort, cadence) - movementSeconds(effort, cadence)) / 3600;
  return Math.round(
    11.8 * weight * jumpHours +
      3.8 * weight * ((effort.pushups * 2) / 3600) +
      5 * weight * ((effort.squats * 2) / 3600) +
      1.5 * weight * restHours,
  );
}

export function makeEntry(block: PlannedBlock): BlockEntry {
  return {
    blockId: block.id,
    done: false,
    touched: false,
    jumps: block.jumps,
    pushups: block.pushups,
    squats: block.squats,
  };
}

export function entryFor(day: DayRecord | null, block: PlannedBlock): BlockEntry {
  return day?.blocks?.[block.id] ?? makeEntry(block);
}

export function emptyDay(date: ISODate, weight: number | null = null): DayRecord {
  return { date, weight, notes: '', blocks: {} };
}

/**
 * Totaux d'une journée. Un bloc compte s'il est coché ou s'il a été modifié à
 * la main — c'est la seule source de vérité, utilisée aussi bien par l'écran du
 * jour que par l'historique et les courbes (les deux divergeaient dans la
 * version web).
 */
export function computeTotals(day: DayRecord | null, settings: Settings): DayTotals {
  const schedule = buildSchedule(settings);
  const weight = day?.weight ?? settings.defaultWeight;
  let doneBlocks = 0;
  let jumps = 0;
  let pushups = 0;
  let squats = 0;
  let kcal = 0;
  let seconds = 0;

  for (const block of schedule) {
    const entry = entryFor(day, block);
    if (entry.done) doneBlocks += 1;
    if (!entry.done && !entry.touched) continue;
    if (!entry.jumps && !entry.pushups && !entry.squats) continue;
    jumps += entry.jumps;
    pushups += entry.pushups;
    squats += entry.squats;
    seconds += blockSeconds(entry, settings.cadence);
    kcal += blockCalories(entry, weight, settings.cadence);
  }

  return {
    doneBlocks,
    blockCount: schedule.length,
    jumps,
    pushups,
    squats,
    kcal: Math.round(kcal),
    seconds: Math.round(seconds),
    targetJumps: settings.dailyJumpTarget,
    percent: schedule.length ? Math.round((doneBlocks / schedule.length) * 100) : 0,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 min';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${hours} h`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}
