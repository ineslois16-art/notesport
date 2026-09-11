/**
 * Agrégats pour l'écran Progression : séries jour par jour, séries en cours,
 * moyennes et records. Tout est calculé à partir de `computeTotals` pour que
 * les courbes et le résumé du jour ne puissent jamais diverger.
 */

import { addDays, daysBetween, monthKey, rangeISO, todayISO, type ISODate } from '../lib/dates';
import { computeTotals, type DayRecord, type DayTotals, type Settings } from './program';

/**
 * Jokers : deux jours vides par mois civil ne cassent plus la série. Le but
 * est de retirer l'incitation à s'entraîner blessé pour ne pas perdre un
 * compteur — c'est ce réflexe-là qui transforme une gêne en tendinite.
 */
export const JOKERS_PER_MONTH = 2;

export type DayPoint = {
  date: ISODate;
  totals: DayTotals;
  weight: number | null;
  hasRecord: boolean;
};

export function buildDayPoints(
  days: DayRecord[],
  settings: Settings,
  from: ISODate,
  to: ISODate,
): DayPoint[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  return rangeISO(from, to).map((date) => {
    const day = byDate.get(date) ?? null;
    return {
      date,
      totals: computeTotals(day, settings),
      weight: day?.weight ?? null,
      hasRecord: Boolean(day),
    };
  });
}

const isActive = (point: DayPoint) => point.totals.doneBlocks > 0;

export type Summary = {
  totalJumps: number;
  totalKcal: number;
  totalSeconds: number;
  totalBlocks: number;
  possibleBlocks: number;
  activeDays: number;
  dayCount: number;
  averageJumps: number;
  consistency: number;
  bestDay: DayPoint | null;
  /** Jours tenus au niveau déclaré, récup comprise — la réussite à noter. */
  onPlanDays: number;
};

export function summarize(points: DayPoint[]): Summary {
  let totalJumps = 0;
  let totalKcal = 0;
  let totalSeconds = 0;
  let totalBlocks = 0;
  let possibleBlocks = 0;
  let activeDays = 0;
  let onPlanDays = 0;
  let bestDay: DayPoint | null = null;

  for (const point of points) {
    totalJumps += point.totals.jumps;
    totalKcal += point.totals.kcal;
    totalSeconds += point.totals.seconds;
    totalBlocks += point.totals.doneBlocks;
    possibleBlocks += point.totals.blockCount;
    if (isActive(point)) activeDays += 1;
    if (point.totals.onPlan) onPlanDays += 1;
    if (!bestDay || point.totals.jumps > bestDay.totals.jumps) bestDay = point;
  }

  return {
    totalJumps,
    totalKcal,
    totalSeconds,
    totalBlocks,
    possibleBlocks,
    activeDays,
    dayCount: points.length,
    averageJumps: points.length ? Math.round(totalJumps / points.length) : 0,
    consistency: possibleBlocks ? Math.round((totalBlocks / possibleBlocks) * 100) : 0,
    bestDay: bestDay && bestDay.totals.jumps > 0 ? bestDay : null,
    onPlanDays,
  };
}

/** Dates où au moins un bloc a été coché — un jour de récup validé en fait partie. */
function activeDates(days: DayRecord[], settings: Settings): Set<ISODate> {
  return new Set(
    days.filter((day) => computeTotals(day, settings).doneBlocks > 0).map((day) => day.date),
  );
}

/** Dépense un joker sur une journée vide, si le mois en a encore un. */
function spendJoker(spent: Map<string, number>, date: ISODate): boolean {
  const month = monthKey(date);
  const used = spent.get(month) ?? 0;
  if (used >= JOKERS_PER_MONTH) return false;
  spent.set(month, used + 1);
  return true;
}

export type StreakInfo = {
  /** Jours réellement actifs d'affilée : un joker protège, il ne s'entraîne pas. */
  days: number;
  /** Jokers consommés par la série en cours, dans le mois civil courant. */
  jokersUsed: number;
  jokersLeft: number;
  /**
   * Journées vides effectivement franchies, de la plus récente à la plus
   * ancienne. Une protection qu'on ne voit pas agir ne rassure personne : c'est
   * ce qui permet de dire « hier était vide, un joker a tenu la série ».
   */
  bridged: ISODate[];
};

/**
 * Série en cours : jours consécutifs avec au moins un bloc terminé. La journée
 * du jour ne casse pas la série tant qu'elle est encore vide (il reste du temps
 * pour s'y mettre), on repart donc d'hier dans ce cas. Les journées vides que
 * la série traverse consomment un joker du mois plutôt que de tout remettre à
 * zéro.
 */
export function streakInfo(days: DayRecord[], settings: Settings): StreakInfo {
  const active = activeDates(days, settings);
  const today = todayISO();
  const spent = new Map<string, number>();
  // Jokers engagés mais pas encore confirmés : un joker n'est dépensé que s'il
  // a réellement franchi un trou. Ceux posés au-delà du début de la série ne
  // protègent rien et sont rendus.
  let pending: ISODate[] = [];
  const canCover = (hole: ISODate) => {
    const month = monthKey(hole);
    const engaged = pending.filter((date) => monthKey(date) === month).length;
    return (spent.get(month) ?? 0) + engaged < JOKERS_PER_MONTH;
  };

  let cursor = active.has(today) ? today : addDays(today, -1);
  let streak = 0;
  const bridged: ISODate[] = [];
  for (;;) {
    if (active.has(cursor)) {
      streak += 1;
      for (const hole of pending) {
        spendJoker(spent, hole);
        bridged.push(hole);
      }
      pending = [];
    } else {
      if (!canCover(cursor)) break;
      pending.push(cursor);
    }
    cursor = addDays(cursor, -1);
  }

  const jokersUsed = spent.get(monthKey(today)) ?? 0;
  return { days: streak, jokersUsed, jokersLeft: JOKERS_PER_MONTH - jokersUsed, bridged };
}

export function currentStreak(days: DayRecord[], settings: Settings): number {
  return streakInfo(days, settings).days;
}

/** Jours pleins d'affilée au terme desquels un jour ménagé est offert. */
export const LIGHT_DAY_AFTER = 6;

export type LightDay = {
  /** Jours de travail tenus d'affilée, en s'arrêtant hier. */
  run: number;
  /** Le jour ménagé est gagné : à annoncer comme un acquis, pas comme un rappel. */
  earned: boolean;
};

/**
 * Un jour ménagé qui se gagne plutôt qu'un deload qui se subit. Après six
 * journées de travail tenues d'affilée, la septième s'ouvre allégée — c'est la
 * seule forme de décharge qu'on applique vraiment. Les jours de récup ne
 * comptent pas dans la série : ils sont déjà de la décharge.
 */
export function lightDay(days: DayRecord[], settings: Settings, from: ISODate = todayISO()): LightDay {
  const held = new Map(
    days.map((day) => [day.date, computeTotals(day, settings)] as const),
  );
  let run = 0;
  let cursor = addDays(from, -1);
  for (;;) {
    const totals = held.get(cursor);
    if (!totals?.onPlan || totals.state === 'recovery') break;
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return { run, earned: run >= LIGHT_DAY_AFTER };
}

export function longestStreak(days: DayRecord[], settings: Settings): number {
  const active = [...activeDates(days, settings)].sort();
  const spent = new Map<string, number>();
  let best = 0;
  let run = 0;
  let previous: ISODate | null = null;

  for (const date of active) {
    run = previous && bridges(previous, date, spent) ? run + 1 : 1;
    previous = date;
    if (run > best) best = run;
  }
  return best;
}

/** Vrai si le trou entre deux jours actifs tient dans les jokers disponibles. */
function bridges(previous: ISODate, date: ISODate, spent: Map<string, number>): boolean {
  const gap = daysBetween(previous, date) - 1;
  if (gap === 0) return true;
  // Deux jokers par mois : un trou de plus de quatre jours ne peut pas tenir,
  // même à cheval sur deux mois. On évite ainsi de parcourir des trous d'un an.
  if (gap > JOKERS_PER_MONTH * 2) return false;

  const holes = rangeISO(addDays(previous, 1), addDays(date, -1));
  const trial = new Map(spent);
  if (!holes.every((hole) => spendJoker(trial, hole))) return false;
  // Les jokers ne sont retenus que si le trou est effectivement franchi.
  for (const [month, used] of trial) spent.set(month, used);
  return true;
}

export type Records = {
  bestJumps: { date: ISODate; value: number } | null;
  bestKcal: { date: ISODate; value: number } | null;
  bestBlocks: { date: ISODate; value: number } | null;
  totalJumpsEver: number;
  activeDaysEver: number;
  /** Le record qui récompense la courbe lisse plutôt que le pic. */
  onPlanDaysEver: number;
};

export function allTimeRecords(days: DayRecord[], settings: Settings): Records {
  let bestJumps: Records['bestJumps'] = null;
  let bestKcal: Records['bestKcal'] = null;
  let bestBlocks: Records['bestBlocks'] = null;
  let totalJumpsEver = 0;
  let activeDaysEver = 0;
  let onPlanDaysEver = 0;

  for (const day of days) {
    const totals = computeTotals(day, settings);
    totalJumpsEver += totals.jumps;
    if (totals.doneBlocks > 0) activeDaysEver += 1;
    if (totals.onPlan) onPlanDaysEver += 1;
    if (totals.jumps > 0 && (!bestJumps || totals.jumps > bestJumps.value)) {
      bestJumps = { date: day.date, value: totals.jumps };
    }
    if (totals.kcal > 0 && (!bestKcal || totals.kcal > bestKcal.value)) {
      bestKcal = { date: day.date, value: totals.kcal };
    }
    if (totals.doneBlocks > 0 && (!bestBlocks || totals.doneBlocks > bestBlocks.value)) {
      bestBlocks = { date: day.date, value: totals.doneBlocks };
    }
  }

  return { bestJumps, bestKcal, bestBlocks, totalJumpsEver, activeDaysEver, onPlanDaysEver };
}

/** Moyenne glissante centrée, utilisée pour la tendance de poids. */
export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  const half = Math.floor(window / 2);
  return values.map((value, index) => {
    if (value === null) return null;
    let sum = 0;
    let count = 0;
    for (let i = index - half; i <= index + half; i += 1) {
      const candidate = values[i];
      if (i >= 0 && i < values.length && candidate !== null && candidate !== undefined) {
        sum += candidate;
        count += 1;
      }
    }
    return count ? sum / count : null;
  });
}

/** Variation entre la première et la dernière valeur renseignée d'une série. */
export function firstLastDelta(values: (number | null)[]): { first: number; last: number; delta: number } | null {
  const filled = values.filter((v): v is number => v !== null);
  if (filled.length < 2) return null;
  const first = filled[0];
  const last = filled[filled.length - 1];
  return { first, last, delta: last - first };
}
