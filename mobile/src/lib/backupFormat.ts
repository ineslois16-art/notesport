/**
 * Lecture et écriture des sauvegardes — partie pure, sans dépendance native,
 * afin de pouvoir être testée hors téléphone.
 *
 * Deux formats sont acceptés à l'import :
 *  - l'export de cette application (`days` = tableau) ;
 *  - l'export de la page web Notesport (`days` = objet indexé
 *    par date, blocs sous la clé `rows`), pour ne pas perdre l'historique.
 */

import {
  buildSchedule,
  computeTotals,
  displayTime,
  formatDuration,
  normalizeSettings,
  type DayRecord,
  type Settings,
} from '../domain/program';
import type { ISODate } from './dates';

export const EXPORT_VERSION = 1;

type ExportedBlock = {
  blockId: string;
  done: boolean;
  touched: boolean;
  time: string | null;
  timeAuto: boolean;
  jumps: number;
  pushups: number;
  squats: number;
};

export type ExportPayload = {
  app: 'notesport';
  version: number;
  exportedAt: string;
  settings: Settings;
  days: { date: ISODate; weight: number | null; notes: string; blocks: ExportedBlock[] }[];
};

const isISODate = (value: unknown): value is ISODate =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** N'accepte qu'une heure « HH:MM » ; tout le reste devient `null`. */
const toClock = (value: unknown): string | null =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;

const toInt = (value: unknown, fallback = 0) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function buildPayload(days: DayRecord[], settings: Settings): ExportPayload {
  return {
    app: 'notesport',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    days: days.map((day) => ({
      date: day.date,
      weight: day.weight,
      notes: day.notes ?? '',
      blocks: Object.values(day.blocks).map((entry) => ({
        blockId: entry.blockId,
        done: entry.done,
        touched: entry.touched,
        time: entry.time,
        timeAuto: entry.timeAuto,
        jumps: entry.jumps,
        pushups: entry.pushups,
        squats: entry.squats,
      })),
    })),
  };
}

export type ParsedBackup = {
  days: DayRecord[];
  settings: Settings | null;
  source: 'application' | 'page web';
};

function parseAppFormat(raw: any): DayRecord[] {
  const days: DayRecord[] = [];
  for (const item of raw.days ?? []) {
    if (!isISODate(item?.date)) continue;
    const blocks: DayRecord['blocks'] = {};
    for (const block of item.blocks ?? []) {
      const id = String(block?.blockId ?? '');
      if (!id) continue;
      blocks[id] = {
        blockId: id,
        done: Boolean(block.done),
        touched: Boolean(block.touched ?? block.done),
        time: toClock(block.time),
        timeAuto: Boolean(block.timeAuto),
        jumps: toInt(block.jumps),
        pushups: toInt(block.pushups),
        squats: toInt(block.squats),
      };
    }
    const weight = Number(item.weight);
    days.push({
      date: item.date,
      weight: Number.isFinite(weight) && weight > 0 ? weight : null,
      notes: typeof item.notes === 'string' ? item.notes : '',
      blocks,
    });
  }
  return days;
}

function parseWebFormat(raw: any): { days: DayRecord[]; settings: Settings } {
  const legacy = raw.settings ?? {};
  const settings = normalizeSettings({
    jumpsPerBlock: toInt(legacy.jumps, 150),
    dailyJumpTarget: toInt(legacy.dailyJumpTarget, 1000),
    pushupsPerBlock: toInt(legacy.pushups, 20),
    squatsPerBlock: toInt(legacy.squats, 20),
    startHour: toInt(legacy.start, 8),
    startMinute: toInt(legacy.startMinute, 0),
    intervalHours: toInt(legacy.interval, 2),
    blockCount: toInt(legacy.blocks, 7),
    cadence: toInt(legacy.cadence, 105),
  });

  const days: DayRecord[] = [];
  for (const [date, value] of Object.entries<any>(raw.days ?? {})) {
    if (!isISODate(date)) continue;
    const blocks: DayRecord['blocks'] = {};
    for (const [blockId, row] of Object.entries<any>(value?.rows ?? {})) {
      // `undefined` : lignes fantômes produites par le bug de la page web.
      if (blockId === 'undefined' || !/^\d+$/.test(blockId)) continue;
      const done = Boolean(row?.done);
      // `reps` : tout premier format de la page web, une seule case par bloc.
      const legacyReps = row?.reps !== undefined;
      blocks[blockId] = {
        blockId,
        done,
        touched: Boolean(row?.entered) || done,
        time: toClock(row?.time),
        timeAuto: Boolean(row?.timeAuto),
        jumps: toInt(row?.jumps, legacyReps ? settings.jumpsPerBlock : 0),
        pushups: toInt(row?.pushups, legacyReps ? settings.pushupsPerBlock : 0),
        squats: toInt(row?.squats, legacyReps ? settings.squatsPerBlock : 0),
      };
    }
    const weight = Number(value?.weight);
    days.push({
      date,
      weight: Number.isFinite(weight) && weight > 0 ? weight : null,
      notes: typeof value?.notes === 'string' ? value.notes : '',
      blocks,
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days, settings };
}

export function parseBackup(text: string): ParsedBackup {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (!raw || typeof raw !== 'object') throw new Error('Fichier de sauvegarde vide ou illisible.');

  if (Array.isArray(raw.days)) {
    const days = parseAppFormat(raw);
    if (!days.length) throw new Error('Aucune journée trouvée dans ce fichier.');
    return { days, settings: raw.settings ? normalizeSettings(raw.settings) : null, source: 'application' };
  }

  if (raw.days && typeof raw.days === 'object') {
    const { days, settings } = parseWebFormat(raw);
    if (!days.length) throw new Error('Aucune journée trouvée dans ce fichier.');
    return { days, settings, source: 'page web' };
  }

  throw new Error("Format non reconnu : ce fichier ne vient pas de Notesport.");
}

const csvCell = (value: string | number) => {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Heures des blocs cochés, dans l'ordre, pour la colonne du tableur. */
function doneTimes(day: DayRecord, settings: Settings): string {
  return buildSchedule(settings)
    .map((block) => {
      const entry = day.blocks[block.id];
      return entry?.done ? displayTime(entry, block) : null;
    })
    .filter(Boolean)
    .join(' ');
}

export function buildCsv(days: DayRecord[], settings: Settings): string {
  const header = [
    'Date',
    'Heures des blocs faits',
    'Blocs faits',
    'Blocs prévus',
    'Sauts',
    'Pompes',
    'Squats',
    'kcal',
    'Durée',
    'Poids (kg)',
    'Notes',
  ];
  const lines = [header.join(';')];

  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const totals = computeTotals(day, settings);
    lines.push(
      [
        day.date,
        doneTimes(day, settings),
        totals.doneBlocks,
        totals.blockCount,
        totals.jumps,
        totals.pushups,
        totals.squats,
        totals.kcal,
        formatDuration(totals.seconds),
        day.weight ?? '',
        day.notes ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  }

  // BOM : Excel ouvre alors correctement les accents.
  return `﻿${lines.join('\n')}`;
}
