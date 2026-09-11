/**
 * Base SQLite locale — tout reste sur le téléphone, rien n'est envoyé sur un
 * serveur. Le schéma est versionné via `PRAGMA user_version` pour pouvoir
 * évoluer sans perdre l'historique.
 */

import * as SQLite from 'expo-sqlite';

import type { ISODate } from '../lib/dates';
import {
  DEFAULT_SETTINGS,
  emptyDay,
  normalizeDayState,
  normalizeSettings,
  type BlockEntry,
  type DayRecord,
  type DayState,
  type Settings,
} from '../domain/program';

// Nom de fichier historique : le renommer ferait repartir l'application
// d'une base vide et perdrait les journées déjà saisies.
const DATABASE_NAME = 'suivi-sportif.db';
const SCHEMA_VERSION = 4;

let handle: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS days (
        date       TEXT PRIMARY KEY NOT NULL,
        weight     REAL,
        notes      TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS block_entries (
        date     TEXT    NOT NULL,
        block_id TEXT    NOT NULL,
        done     INTEGER NOT NULL DEFAULT 0,
        touched  INTEGER NOT NULL DEFAULT 0,
        jumps    INTEGER NOT NULL DEFAULT 0,
        pushups  INTEGER NOT NULL DEFAULT 0,
        squats   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, block_id),
        FOREIGN KEY (date) REFERENCES days(date) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_block_entries_date ON block_entries(date);
    `);
  }

  if (version < 2) {
    // Heure réelle du bloc, à la minute. NULL = l'heure de repère s'applique.
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(block_entries)');
    if (!columns.some((column) => column.name === 'time')) {
      await db.execAsync('ALTER TABLE block_entries ADD COLUMN time TEXT');
    }
  }

  if (version < 3) {
    // Distingue l'heure posée par la validation d'une heure saisie à la main.
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(block_entries)');
    if (!columns.some((column) => column.name === 'time_auto')) {
      await db.execAsync('ALTER TABLE block_entries ADD COLUMN time_auto INTEGER NOT NULL DEFAULT 0');
    }
  }

  if (version < 4) {
    // État déclaré du jour. Les journées déjà enregistrées repartent en
    // « fresh » : leurs chiffres restent identiques au jour près.
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(days)');
    if (!columns.some((column) => column.name === 'state')) {
      await db.execAsync("ALTER TABLE days ADD COLUMN state TEXT NOT NULL DEFAULT 'fresh'");
    }
  }

  if (version !== SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!handle) {
    handle = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })().catch((error) => {
      handle = null;
      throw error;
    });
  }
  return handle;
}

/* -------------------------------------------------------------- réglages */

export async function readSettings(): Promise<Settings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    try {
      stored[key] = JSON.parse(value);
    } catch {
      stored[key] = value;
    }
  }
  return normalizeSettings(stored as Partial<Settings>);
}

export async function writeSettings(settings: Settings): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(settings);
  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, JSON.stringify(value)],
      );
    }
  });
}

/* -------------------------------------------------------------- journées */

type DayRow = { date: string; weight: number | null; notes: string; state: string | null };
type BlockRow = {
  date: string;
  block_id: string;
  done: number;
  touched: number;
  time: string | null;
  time_auto: number;
  jumps: number;
  pushups: number;
  squats: number;
};

function toEntry(row: BlockRow): BlockEntry {
  return {
    blockId: row.block_id,
    done: row.done === 1,
    touched: row.touched === 1,
    time: row.time ?? null,
    timeAuto: row.time_auto === 1,
    jumps: row.jumps,
    pushups: row.pushups,
    squats: row.squats,
  };
}

function assemble(dayRows: DayRow[], blockRows: BlockRow[]): DayRecord[] {
  const byDate = new Map<string, DayRecord>();
  for (const row of dayRows) {
    byDate.set(row.date, {
      date: row.date,
      weight: row.weight,
      notes: row.notes ?? '',
      state: normalizeDayState(row.state),
      blocks: {},
    });
  }
  for (const row of blockRows) {
    const day = byDate.get(row.date);
    if (day) day.blocks[row.block_id] = toEntry(row);
  }
  return [...byDate.values()];
}

export async function readDay(date: ISODate): Promise<DayRecord | null> {
  const db = await getDatabase();
  const day = await db.getFirstAsync<DayRow>('SELECT date, weight, notes, state FROM days WHERE date = ?', [date]);
  if (!day) return null;
  const blocks = await db.getAllAsync<BlockRow>('SELECT * FROM block_entries WHERE date = ?', [date]);
  return assemble([day], blocks)[0];
}

export async function readRange(from: ISODate, to: ISODate): Promise<DayRecord[]> {
  const db = await getDatabase();
  const days = await db.getAllAsync<DayRow>(
    'SELECT date, weight, notes, state FROM days WHERE date BETWEEN ? AND ? ORDER BY date',
    [from, to],
  );
  if (!days.length) return [];
  const blocks = await db.getAllAsync<BlockRow>(
    'SELECT * FROM block_entries WHERE date BETWEEN ? AND ?',
    [from, to],
  );
  return assemble(days, blocks);
}

export async function readAllDays(): Promise<DayRecord[]> {
  const db = await getDatabase();
  const days = await db.getAllAsync<DayRow>('SELECT date, weight, notes, state FROM days ORDER BY date');
  if (!days.length) return [];
  const blocks = await db.getAllAsync<BlockRow>('SELECT * FROM block_entries');
  return assemble(days, blocks);
}

export async function readLastKnownWeight(onOrBefore: ISODate): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ weight: number }>(
    'SELECT weight FROM days WHERE weight IS NOT NULL AND date <= ? ORDER BY date DESC LIMIT 1',
    [onOrBefore],
  );
  return row?.weight ?? null;
}

async function ensureDayRow(db: SQLite.SQLiteDatabase, date: ISODate) {
  await db.runAsync(
    "INSERT INTO days (date, weight, notes, updated_at) VALUES (?, NULL, '', ?) ON CONFLICT(date) DO NOTHING",
    [date, new Date().toISOString()],
  );
}

export async function saveDayMeta(date: ISODate, weight: number | null, notes: string): Promise<void> {
  const db = await getDatabase();
  await ensureDayRow(db, date);
  await db.runAsync('UPDATE days SET weight = ?, notes = ?, updated_at = ? WHERE date = ?', [
    weight,
    notes,
    new Date().toISOString(),
    date,
  ]);
}

export async function saveDayState(date: ISODate, state: DayState): Promise<void> {
  const db = await getDatabase();
  await ensureDayRow(db, date);
  await db.runAsync('UPDATE days SET state = ?, updated_at = ? WHERE date = ?', [
    state,
    new Date().toISOString(),
    date,
  ]);
}

export async function saveBlockEntry(date: ISODate, entry: BlockEntry): Promise<void> {
  const db = await getDatabase();
  await ensureDayRow(db, date);
  await db.runAsync(
    `INSERT INTO block_entries (date, block_id, done, touched, time, time_auto, jumps, pushups, squats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, block_id) DO UPDATE SET
       done = excluded.done, touched = excluded.touched, time = excluded.time,
       time_auto = excluded.time_auto,
       jumps = excluded.jumps, pushups = excluded.pushups, squats = excluded.squats`,
    [
      date,
      entry.blockId,
      entry.done ? 1 : 0,
      entry.touched ? 1 : 0,
      entry.time,
      entry.timeAuto ? 1 : 0,
      entry.jumps,
      entry.pushups,
      entry.squats,
    ],
  );
  await db.runAsync('UPDATE days SET updated_at = ? WHERE date = ?', [new Date().toISOString(), date]);
}

/** Supprime une journée devenue vide pour ne pas polluer l'historique. */
export async function pruneDay(date: ISODate): Promise<void> {
  const db = await getDatabase();
  // Un état déclaré est une décision : il retient la journée même vide.
  await db.runAsync(
    `DELETE FROM days WHERE date = ?
       AND weight IS NULL AND notes = '' AND state = 'fresh'
       AND NOT EXISTS (SELECT 1 FROM block_entries WHERE block_entries.date = days.date AND (done = 1 OR touched = 1))`,
    [date],
  );
}

export async function deleteEverything(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM block_entries; DELETE FROM days; DELETE FROM settings;');
}

/** Import : remplace tout le contenu en une transaction (tout ou rien). */
export async function replaceAll(days: DayRecord[], settings: Settings): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM block_entries');
    await db.runAsync('DELETE FROM days');
    const now = new Date().toISOString();
    for (const day of days) {
      await db.runAsync('INSERT INTO days (date, weight, notes, state, updated_at) VALUES (?, ?, ?, ?, ?)', [
        day.date,
        day.weight,
        day.notes ?? '',
        normalizeDayState(day.state),
        now,
      ]);
      for (const entry of Object.values(day.blocks)) {
        await db.runAsync(
          `INSERT INTO block_entries (date, block_id, done, touched, time, time_auto, jumps, pushups, squats)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            day.date,
            entry.blockId,
            entry.done ? 1 : 0,
            entry.touched ? 1 : 0,
            entry.time,
            entry.timeAuto ? 1 : 0,
            entry.jumps,
            entry.pushups,
            entry.squats,
          ],
        );
      }
    }
  });
  await writeSettings(settings);
}

/** Fusion : les journées importées écrasent les journées de même date. */
export async function mergeDays(days: DayRecord[]): Promise<number> {
  const db = await getDatabase();
  let imported = 0;
  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();
    for (const day of days) {
      await db.runAsync(
        `INSERT INTO days (date, weight, notes, state, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, notes = excluded.notes,
           state = excluded.state, updated_at = excluded.updated_at`,
        [day.date, day.weight, day.notes ?? '', normalizeDayState(day.state), now],
      );
      await db.runAsync('DELETE FROM block_entries WHERE date = ?', [day.date]);
      for (const entry of Object.values(day.blocks)) {
        await db.runAsync(
          `INSERT INTO block_entries (date, block_id, done, touched, time, time_auto, jumps, pushups, squats)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            day.date,
            entry.blockId,
            entry.done ? 1 : 0,
            entry.touched ? 1 : 0,
            entry.time,
            entry.timeAuto ? 1 : 0,
            entry.jumps,
            entry.pushups,
            entry.squats,
          ],
        );
      }
      imported += 1;
    }
  });
  return imported;
}

export { DEFAULT_SETTINGS, emptyDay };
