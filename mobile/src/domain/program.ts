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
  /** Minute de départ de la grille de repère (08:30 aussi bien que 08:00). */
  startMinute: number;
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
  startMinute: 0,
  intervalHours: 2,
  blockCount: 7,
  cadence: 105,
  defaultWeight: 97,
  remindersEnabled: false,
};

/**
 * Niveau déclaré du jour, qui module la charge. Un jour tenu au niveau déclaré
 * est une réussite pleine : c'est le calibrage qui est noté, pas le maximum.
 * `recovery` est le jour de repos — il se coche, donc il compte.
 *
 * Les identifiants ne changent jamais (ils sont en base et dans les
 * sauvegardes) ; seuls les libellés sont lisibles. « Normal » disait un niveau
 * réduit tout en se lisant comme la norme : les libellés nomment désormais la
 * charge, pas l'humeur.
 */
export type DayState = 'fresh' | 'normal' | 'spent' | 'recovery';

export const DAY_STATES: { id: DayState; label: string; hint: string; factor: number }[] = [
  { id: 'fresh', label: 'Plein', hint: 'programme entier', factor: 1 },
  { id: 'normal', label: 'Allégé', hint: 'un cran en dessous', factor: 0.8 },
  { id: 'spent', label: 'Ménagé', hint: 'moitié de charge', factor: 0.5 },
  { id: 'recovery', label: 'Récup', hint: 'repos, et ça compte', factor: 0 },
];

/**
 * Tolérance au-dessus de la cible du jour. Tenir son niveau, c'est rester dans
 * la fourchette : au-delà, le niveau est dépassé, pas tenu. Sans ce plafond,
 * rebasculer une grosse journée en « Ménagé » après coup la ferait passer pour
 * une journée ménagée — et un jour déclaré ménagé où l'on fait le double est
 * précisément le jour à risque.
 */
export const OVERSHOOT_MARGIN = 1.15;

/**
 * Le bloc du jour de récupération porte un identifiant à lui : les blocs de
 * travail déjà saisis restent en base intacts si l'on bascule en Récup puis
 * qu'on revient en arrière.
 */
export const RECOVERY_BLOCK_ID = 'rest';

export function normalizeDayState(value: unknown): DayState {
  return DAY_STATES.some((state) => state.id === value) ? (value as DayState) : 'fresh';
}

export function dayStateFactor(state: DayState): number {
  return DAY_STATES.find((item) => item.id === state)?.factor ?? 1;
}

export function dayStateLabel(state: DayState): string {
  return DAY_STATES.find((item) => item.id === state)?.label ?? 'Frais';
}

export type PlannedBlock = {
  id: string;
  hour: number;
  minute: number;
  /** Heure de repère « HH:MM » — l'heure réelle se saisit sur chaque journée. */
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
  /** Vrai dès que la ligne a été touchée : distingue une valeur saisie du modèle. */
  touched: boolean;
  /** Heure réelle « HH:MM », `null` tant que rien n'a été saisi ni horodaté. */
  time: string | null;
  /** Vrai si l'heure a été posée par la validation, pas saisie à la main :
   *  elle repart alors avec le décochage. */
  timeAuto: boolean;
};

export type DayRecord = {
  date: ISODate;
  weight: number | null;
  notes: string;
  state: DayState;
  blocks: Record<string, BlockEntry>;
};

export type DayTotals = {
  state: DayState;
  doneBlocks: number;
  blockCount: number;
  jumps: number;
  pushups: number;
  squats: number;
  kcal: number;
  seconds: number;
  targetJumps: number;
  percent: number;
  /** Journée tenue au niveau déclaré — la réussite, quel que soit le niveau. */
  onPlan: boolean;
  /** Charge nettement au-dessus du niveau déclaré : signalée, jamais félicitée. */
  overshot: boolean;
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
    startMinute: clampInt(s.startMinute, 0, 59),
    intervalHours: clampInt(s.intervalHours, 1, 12),
    blockCount: clampInt(s.blockCount, 1, 24),
    cadence: clampInt(s.cadence, 30, 250),
    defaultWeight: Math.min(300, Math.max(20, Number(s.defaultWeight) || DEFAULT_SETTINGS.defaultWeight)),
    remindersEnabled: Boolean(s.remindersEnabled),
  };
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function nowClock(date = new Date()): string {
  return formatClock(date.getHours(), date.getMinutes());
}

/** Heure affichée pour un bloc : celle qui a été saisie, sinon le repère. */
export function displayTime(entry: BlockEntry | null | undefined, block: PlannedBlock): string {
  return entry?.time ?? block.label;
}

/** « HH:MM » → minutes depuis minuit ; `null` si la chaîne n'est pas une heure. */
export function clockToMinutes(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Charge ramenée au niveau déclaré. On allège les répétitions sans toucher au
 * nombre de blocs : l'espacement entre deux efforts est justement ce qui
 * protège les tendons, c'est la dernière chose à raboter.
 */
export function scaleSettings(settings: Settings, state: DayState): Settings {
  const factor = dayStateFactor(state);
  if (factor === 1) return settings;
  const scale = (value: number) => Math.round(value * factor);
  return {
    ...settings,
    jumpsPerBlock: scale(settings.jumpsPerBlock),
    dailyJumpTarget: scale(settings.dailyJumpTarget),
    pushupsPerBlock: scale(settings.pushupsPerBlock),
    squatsPerBlock: scale(settings.squatsPerBlock),
  };
}

/**
 * Répartit l'objectif quotidien sur les blocs : chaque bloc prend au plus
 * `jumpsPerBlock`, le dernier absorbe le reste (7 × 150 → 6 × 150 + 100 = 1 000).
 * Un jour de récupération n'a qu'un bloc, vide : il se coche, et cocher suffit.
 */
export function buildSchedule(settings: Settings, state: DayState = 'fresh'): PlannedBlock[] {
  if (state === 'recovery') {
    const { startHour: hour, startMinute: minute } = settings;
    return [
      {
        id: RECOVERY_BLOCK_ID,
        hour,
        minute,
        label: formatClock(hour, minute),
        jumps: 0,
        pushups: 0,
        squats: 0,
      },
    ];
  }

  const scaled = scaleSettings(settings, state);
  let remaining = scaled.dailyJumpTarget;
  return Array.from({ length: scaled.blockCount }, (_, index) => {
    const total =
      (scaled.startHour * 60 + scaled.startMinute + index * scaled.intervalHours * 60) % 1440;
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    const jumps = Math.min(scaled.jumpsPerBlock, Math.max(0, remaining));
    remaining -= jumps;
    return {
      id: String(index),
      hour,
      minute,
      label: formatClock(hour, minute),
      jumps,
      pushups: scaled.pushupsPerBlock,
      squats: scaled.squatsPerBlock,
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
    time: null,
    timeAuto: false,
    jumps: block.jumps,
    pushups: block.pushups,
    squats: block.squats,
  };
}

export function entryFor(day: DayRecord | null, block: PlannedBlock): BlockEntry {
  return day?.blocks?.[block.id] ?? makeEntry(block);
}

export function emptyDay(date: ISODate, weight: number | null = null, state: DayState = 'fresh'): DayRecord {
  return { date, weight, notes: '', state, blocks: {} };
}

/**
 * Totaux d'une journée. **Seuls les blocs cochés « Fait » comptent** : des
 * répétitions saisies sans avoir coché restent une intention, pas une séance.
 * Source de vérité unique de l'écran du jour, de l'historique et des courbes.
 */
export function computeTotals(day: DayRecord | null, settings: Settings): DayTotals {
  const state = day?.state ?? 'fresh';
  const schedule = buildSchedule(settings, state);
  const weight = day?.weight ?? settings.defaultWeight;
  let doneBlocks = 0;
  let jumps = 0;
  let pushups = 0;
  let squats = 0;
  let kcal = 0;
  let seconds = 0;

  for (const block of schedule) {
    const entry = entryFor(day, block);
    if (!entry.done) continue;
    doneBlocks += 1;
    if (!entry.jumps && !entry.pushups && !entry.squats) continue;
    jumps += entry.jumps;
    pushups += entry.pushups;
    squats += entry.squats;
    seconds += blockSeconds(entry, settings.cadence);
    kcal += blockCalories(entry, weight, settings.cadence);
  }

  const targetJumps = state === 'recovery' ? 0 : scaleSettings(settings, state).dailyJumpTarget;
  const ceiling = Math.round(targetJumps * OVERSHOOT_MARGIN);
  const overshot = jumps > ceiling;

  return {
    state,
    doneBlocks,
    blockCount: schedule.length,
    jumps,
    pushups,
    squats,
    kcal: Math.round(kcal),
    seconds: Math.round(seconds),
    targetJumps,
    percent: schedule.length ? Math.round((doneBlocks / schedule.length) * 100) : 0,
    // Tenir un jour « Ménagé » à 500 sauts vaut tenir un jour « Plein » à 1 000,
    // mais tenir suppose de rester dans la fourchette : au-delà du plafond, le
    // niveau est dépassé.
    onPlan: doneBlocks >= schedule.length && jumps >= targetJumps && !overshot,
    overshot,
  };
}

/**
 * Vrai si la journée porte du travail validé, hors bloc de récup. Une telle
 * journée ne peut pas être déclarée « Récup » : la charge subie disparaîtrait
 * de l'historique, et c'est précisément la donnée qui relie douleur et volume.
 */
export function hasLoggedWork(day: DayRecord | null): boolean {
  return Object.values(day?.blocks ?? {}).some(
    (entry) =>
      entry.done &&
      entry.blockId !== RECOVERY_BLOCK_ID &&
      (entry.jumps > 0 || entry.pushups > 0 || entry.squats > 0),
  );
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
