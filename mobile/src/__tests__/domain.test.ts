/**
 * Tests du cœur métier, exécutables sans téléphone :
 *   npm test
 * Ils couvrent le calcul du programme, les totaux, les séries et la relecture
 * des sauvegardes (y compris celles produites par la page web d'origine).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSchedule,
  clockToMinutes,
  computeTotals,
  DEFAULT_SETTINGS,
  displayTime,
  emptyDay,
  formatClock,
  formatDuration,
  normalizeSettings,
  nowClock,
  type DayRecord,
} from '../domain/program';
import { allTimeRecords, buildDayPoints, currentStreak, longestStreak, summarize } from '../domain/stats';
import { addDays, daysBetween, rangeISO, toISO, todayISO } from '../lib/dates';
import { buildCsv, buildPayload, parseBackup } from '../lib/backupFormat';

const settings = DEFAULT_SETTINGS;

function dayWith(date: string, doneBlockIds: string[], weight: number | null = null): DayRecord {
  const day = emptyDay(date, weight);
  for (const block of buildSchedule(settings)) {
    if (!doneBlockIds.includes(block.id)) continue;
    day.blocks[block.id] = {
      blockId: block.id,
      done: true,
      touched: true,
      time: null,
      jumps: block.jumps,
      pushups: block.pushups,
      squats: block.squats,
    };
  }
  return day;
}

test('le programme par défaut atteint exactement 1 000 sauts', () => {
  const schedule = buildSchedule(settings);
  assert.equal(schedule.length, 7);
  assert.equal(
    schedule.reduce((total, block) => total + block.jumps, 0),
    1000,
  );
  assert.deepEqual(
    schedule.map((block) => block.jumps),
    [150, 150, 150, 150, 150, 150, 100],
  );
  assert.equal(schedule[0].label, '08:00');
  assert.equal(schedule[6].label, '20:00');
});

test('les heures repassent par minuit sans sortir de 0-23', () => {
  const schedule = buildSchedule(normalizeSettings({ ...settings, startHour: 22, intervalHours: 3, blockCount: 3 }));
  assert.deepEqual(
    schedule.map((block) => block.label),
    ['22:00', '01:00', '04:00'],
  );
});

test('un objectif nul reste nul au lieu de repartir aux valeurs par défaut', () => {
  const schedule = buildSchedule(normalizeSettings({ ...settings, dailyJumpTarget: 0 }));
  assert.equal(
    schedule.reduce((total, block) => total + block.jumps, 0),
    0,
  );
});

test('les totaux ne comptent que les blocs cochés', () => {
  const day = dayWith('2026-09-10', ['0', '1'], 95);
  const totals = computeTotals(day, settings);
  assert.equal(totals.doneBlocks, 2);
  assert.equal(totals.jumps, 300);
  assert.equal(totals.pushups, 40);
  assert.equal(totals.squats, 40);
  assert.equal(totals.percent, 29);
  assert.ok(totals.kcal > 0, 'les calories doivent être estimées');

  const untouched = computeTotals(emptyDay('2026-09-10'), settings);
  assert.equal(untouched.jumps, 0);
  assert.equal(untouched.doneBlocks, 0);
  assert.equal(untouched.kcal, 0);
});

test('un bloc modifié mais non coché ne compte nulle part', () => {
  const day = emptyDay('2026-09-10');
  day.blocks['0'] = { blockId: '0', done: false, touched: true, time: null, jumps: 80, pushups: 10, squats: 0 };
  const totals = computeTotals(day, settings);
  assert.equal(totals.doneBlocks, 0);
  assert.equal(totals.jumps, 0, 'des répétitions saisies sans cocher restent une intention');
  assert.equal(totals.pushups, 0);
  assert.equal(totals.kcal, 0);

  // Une fois coché, le même bloc compte avec ses valeurs ajustées.
  day.blocks['0'].done = true;
  const after = computeTotals(day, settings);
  assert.equal(after.doneBlocks, 1);
  assert.equal(after.jumps, 80);
  assert.equal(after.pushups, 10);
});

test('la grille de repère accepte une minute de départ', () => {
  const schedule = buildSchedule(normalizeSettings({ ...settings, startHour: 8, startMinute: 35, blockCount: 3 }));
  assert.deepEqual(
    schedule.map((block) => block.label),
    ['08:35', '10:35', '12:35'],
  );
  assert.deepEqual(
    schedule.map((block) => [block.hour, block.minute]),
    [
      [8, 35],
      [10, 35],
      [12, 35],
    ],
  );
});

test('l’heure saisie remplace le repère, sans l’effacer', () => {
  const [block] = buildSchedule(settings);
  assert.equal(block.label, '08:00');
  assert.equal(displayTime(null, block), '08:00', 'sans saisie, le repère s’affiche');

  const entry = { blockId: '0', done: true, touched: true, time: '07:42', jumps: 150, pushups: 20, squats: 20 };
  assert.equal(displayTime(entry, block), '07:42');
  assert.equal(block.label, '08:00', 'le repère du programme reste inchangé');
});

test('les heures se convertissent dans les deux sens', () => {
  assert.equal(formatClock(7, 5), '07:05');
  assert.equal(clockToMinutes('07:42'), 462);
  assert.equal(clockToMinutes('00:00'), 0);
  assert.equal(clockToMinutes('23:59'), 1439);
  assert.equal(clockToMinutes('24:00'), null);
  assert.equal(clockToMinutes('7h42'), null);
  assert.equal(clockToMinutes(null), null);
  assert.equal(nowClock(new Date(2026, 8, 10, 20, 24)), '20:24');
});

test('un poids plus élevé augmente la dépense estimée', () => {
  const light = computeTotals(dayWith('2026-09-10', ['0'], 70), settings);
  const heavy = computeTotals(dayWith('2026-09-10', ['0'], 110), settings);
  assert.ok(heavy.kcal > light.kcal);
});

test('la série en cours s’arrête au premier jour manqué', () => {
  const today = todayISO();
  const days = [
    dayWith(addDays(today, -1), ['0']),
    dayWith(addDays(today, -2), ['0']),
    dayWith(addDays(today, -4), ['0']),
  ];
  assert.equal(currentStreak(days, settings), 2, "la journée d'aujourd'hui encore vide ne casse pas la série");
  assert.equal(longestStreak(days, settings), 2);

  const withToday = [...days, dayWith(today, ['0'])];
  assert.equal(currentStreak(withToday, settings), 3);
});

test('les jours sans enregistrement apparaissent à zéro dans les courbes', () => {
  const points = buildDayPoints([dayWith('2026-09-08', ['0'])], settings, '2026-09-06', '2026-09-10');
  assert.equal(points.length, 5);
  assert.deepEqual(
    points.map((point) => point.totals.jumps),
    [0, 0, 150, 0, 0],
  );
  const summary = summarize(points);
  assert.equal(summary.totalJumps, 150);
  assert.equal(summary.activeDays, 1);
  assert.equal(summary.dayCount, 5);
});

test('les records reprennent la meilleure journée', () => {
  const days = [dayWith('2026-09-08', ['0']), dayWith('2026-09-09', ['0', '1', '2'])];
  const records = allTimeRecords(days, settings);
  assert.equal(records.bestJumps?.date, '2026-09-09');
  assert.equal(records.bestJumps?.value, 450);
  assert.equal(records.activeDaysEver, 2);
  assert.equal(records.totalJumpsEver, 600);
});

test('les dates restent locales et cohérentes', () => {
  assert.equal(toISO(new Date(2026, 8, 10)), '2026-09-10');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-09-01', '2026-09-10'), 9);
  assert.equal(rangeISO('2026-09-08', '2026-09-10').length, 3);
});

test('les durées sont lisibles', () => {
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(540), '9 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(4500), '1 h 15');
});

test('relit une sauvegarde de la page web, bloc fantôme compris', () => {
  const webExport = JSON.stringify({
    settings: { jumps: 150, dailyJumpTarget: 1000, pushups: 20, squats: 20, start: 8, interval: 2, blocks: 7, cadence: 105 },
    days: {
      '2026-09-09': {
        weight: 96.4,
        notes: 'Bonne énergie',
        rows: {
          '0': { done: true, entered: true, time: '07:42', jumps: 150, pushups: 20, squats: 20 },
          '1': { done: false, entered: true, time: '9h05', jumps: 60, pushups: 0, squats: 0 },
          undefined: { done: true, jumps: 0 },
        },
      },
      '2026-09-10': { weight: 96, notes: '', rows: { '0': { done: true, reps: true } } },
    },
  });

  const parsed = parseBackup(webExport);
  assert.equal(parsed.source, 'page web');
  assert.equal(parsed.days.length, 2);
  assert.equal(parsed.settings?.jumpsPerBlock, 150);
  assert.equal(parsed.settings?.dailyJumpTarget, 1000);

  const first = parsed.days[0];
  assert.equal(first.date, '2026-09-09');
  assert.equal(first.weight, 96.4);
  assert.equal(Object.keys(first.blocks).length, 2, 'la ligne "undefined" du bug doit être ignorée');
  // Seul le bloc coché compte : 150, pas 210.
  assert.equal(computeTotals(first, settings).jumps, 150);
  assert.equal(first.blocks['0'].time, '07:42', 'l’heure saisie sur la page web est reprise');
  assert.equal(first.blocks['1'].time, null, 'une heure absente ou invalide devient null');

  // Ancien format « reps » : le bloc reprend les valeurs prévues.
  assert.equal(parsed.days[1].blocks['0'].jumps, 150);
});

test('un aller-retour export/import de l’application conserve les journées', () => {
  const days = [dayWith('2026-09-09', ['0', '1'], 96), dayWith('2026-09-10', ['0'], 95.5)];
  days[0].blocks['0'].time = '07:42';
  const parsed = parseBackup(JSON.stringify(buildPayload(days, settings)));
  assert.equal(parsed.source, 'application');
  assert.equal(parsed.days.length, 2);
  assert.deepEqual(computeTotals(parsed.days[0], settings), computeTotals(days[0], settings));
  assert.equal(parsed.days[0].blocks['0'].time, '07:42', 'l’heure réelle survit à l’aller-retour');
  assert.equal(parsed.settings?.cadence, settings.cadence);
});

test('un fichier illisible est refusé avec un message clair', () => {
  assert.throws(() => parseBackup('pas du json'), /JSON valide/);
  assert.throws(() => parseBackup('{"autre":1}'), /Format non reconnu/);
  assert.throws(() => parseBackup('{"days":{}}'), /Aucune journée/);
});

test('le CSV échappe les notes contenant des points-virgules', () => {
  const day = dayWith('2026-09-10', ['0'], 96);
  day.notes = 'Genou sensible; repos demain';
  day.blocks['0'].time = '07:42';
  const csv = buildCsv([day], settings);
  const lines = csv.split('\n');
  assert.match(lines[0], /^﻿Date;Heures des blocs faits;/);
  assert.match(lines[1], /"Genou sensible; repos demain"$/);
  assert.match(lines[1], /^2026-09-10;07:42;1;7;150;20;20;/);
});
