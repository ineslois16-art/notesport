/**
 * Agrégats pour l'écran Progression : séries jour par jour, séries en cours,
 * moyennes et records. Tout est calculé à partir de `computeTotals` pour que
 * les courbes et le résumé du jour ne puissent jamais diverger.
 */

import { addDays, rangeISO, todayISO, type ISODate } from '../lib/dates';
import { computeTotals, type DayRecord, type DayTotals, type Settings } from './program';

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
  targetHitDays: number;
};

export function summarize(points: DayPoint[]): Summary {
  let totalJumps = 0;
  let totalKcal = 0;
  let totalSeconds = 0;
  let totalBlocks = 0;
  let possibleBlocks = 0;
  let activeDays = 0;
  let targetHitDays = 0;
  let bestDay: DayPoint | null = null;

  for (const point of points) {
    totalJumps += point.totals.jumps;
    totalKcal += point.totals.kcal;
    totalSeconds += point.totals.seconds;
    totalBlocks += point.totals.doneBlocks;
    possibleBlocks += point.totals.blockCount;
    if (isActive(point)) activeDays += 1;
    if (point.totals.targetJumps > 0 && point.totals.jumps >= point.totals.targetJumps) targetHitDays += 1;
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
    targetHitDays,
  };
}

/**
 * Série en cours : jours consécutifs avec au moins un bloc terminé. La journée
 * du jour ne casse pas la série tant qu'elle est encore vide (il reste du temps
 * pour s'y mettre), on repart donc d'hier dans ce cas.
 */
export function currentStreak(days: DayRecord[], settings: Settings): number {
  const active = new Set(
    days.filter((day) => computeTotals(day, settings).doneBlocks > 0).map((day) => day.date),
  );
  if (!active.size) return 0;

  const today = todayISO();
  let cursor = active.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(days: DayRecord[], settings: Settings): number {
  const active = days
    .filter((day) => computeTotals(day, settings).doneBlocks > 0)
    .map((day) => day.date)
    .sort();
  let best = 0;
  let run = 0;
  let previous: ISODate | null = null;
  for (const date of active) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    previous = date;
    if (run > best) best = run;
  }
  return best;
}

export type Records = {
  bestJumps: { date: ISODate; value: number } | null;
  bestKcal: { date: ISODate; value: number } | null;
  bestBlocks: { date: ISODate; value: number } | null;
  totalJumpsEver: number;
  activeDaysEver: number;
};

export function allTimeRecords(days: DayRecord[], settings: Settings): Records {
  let bestJumps: Records['bestJumps'] = null;
  let bestKcal: Records['bestKcal'] = null;
  let bestBlocks: Records['bestBlocks'] = null;
  let totalJumpsEver = 0;
  let activeDaysEver = 0;

  for (const day of days) {
    const totals = computeTotals(day, settings);
    totalJumpsEver += totals.jumps;
    if (totals.doneBlocks > 0) activeDaysEver += 1;
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

  return { bestJumps, bestKcal, bestBlocks, totalJumpsEver, activeDaysEver };
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
