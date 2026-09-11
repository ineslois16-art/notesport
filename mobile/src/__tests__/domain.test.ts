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
  hasLoggedWork,
  normalizeDayState,
  normalizeSettings,
  nowClock,
  RECOVERY_BLOCK_ID,
  type DayRecord,
  type DayState,
} from '../domain/program';
import {
  allTimeRecords,
  buildDayPoints,
  currentStreak,
  LIGHT_DAY_AFTER,
  lightDay,
  longestStreak,
  streakInfo,
  summarize,
} from '../domain/stats';
import { addDays, daysBetween, rangeISO, toISO, todayISO } from '../lib/dates';
import { buildCsv, buildPayload, parseBackup } from '../lib/backupFormat';

const settings = DEFAULT_SETTINGS;

function dayWith(
  date: string,
  doneBlockIds: string[],
  weight: number | null = null,
  state: DayState = 'fresh',
): DayRecord {
  const day = emptyDay(date, weight, state);
  for (const block of buildSchedule(settings, state)) {
    if (!doneBlockIds.includes(block.id)) continue;
    day.blocks[block.id] = {
      blockId: block.id,
      done: true,
      touched: true,
      time: null,
      timeAuto: false,
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
  day.blocks['0'] = { blockId: '0', done: false, touched: true, time: null, timeAuto: false, jumps: 80, pushups: 10, squats: 0 };
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

  const entry = { blockId: '0', done: true, touched: true, time: '07:42', timeAuto: false, jumps: 150, pushups: 20, squats: 20 };
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

test('la série en cours s’arrête au trou que les jokers ne couvrent plus', () => {
  const today = todayISO();
  // Sept jours vides : deux jokers par mois n'y suffisent pas, même à cheval
  // sur deux mois.
  const days = [
    dayWith(addDays(today, -1), ['0']),
    dayWith(addDays(today, -2), ['0']),
    dayWith(addDays(today, -10), ['0']),
  ];
  assert.equal(currentStreak(days, settings), 2, "la journée d'aujourd'hui encore vide ne casse pas la série");
  assert.equal(longestStreak(days, settings), 2);

  const withToday = [...days, dayWith(today, ['0'])];
  assert.equal(currentStreak(withToday, settings), 3);
});

test('un niveau déclaré allège la charge sans toucher à l’espacement', () => {
  const spent = buildSchedule(settings, 'spent');
  assert.equal(spent.length, 7, 'l’espacement entre efforts protège les tendons : on garde les 7 blocs');
  assert.equal(
    spent.reduce((total, block) => total + block.jumps, 0),
    500,
  );
  assert.deepEqual(
    spent.map((block) => block.label),
    buildSchedule(settings, 'fresh').map((block) => block.label),
    'les horaires ne bougent pas d’un niveau à l’autre',
  );
  assert.equal(spent[0].pushups, 10);
  assert.equal(spent[0].squats, 10);

  const normal = buildSchedule(settings, 'normal');
  assert.equal(
    normal.reduce((total, block) => total + block.jumps, 0),
    800,
  );
});

test('tenir un jour ménagé vaut tenir un jour plein', () => {
  const hard = computeTotals(dayWith('2026-05-12', ['0', '1', '2', '3', '4', '5', '6']), settings);
  const easy = computeTotals(
    dayWith('2026-05-12', ['0', '1', '2', '3', '4', '5', '6'], null, 'spent'),
    settings,
  );

  assert.equal(hard.targetJumps, 1000);
  assert.equal(easy.targetJumps, 500, 'l’objectif suit le niveau déclaré');
  assert.equal(easy.jumps, 500);
  assert.ok(hard.onPlan && easy.onPlan, 'les deux journées sont tenues');
  assert.equal(easy.percent, 100);

  // Une journée entamée mais pas tenue reste une journée non tenue.
  assert.equal(computeTotals(dayWith('2026-05-12', ['0'], null, 'spent'), settings).onPlan, false);
});

test('un jour de récup se coche, et cocher suffit', () => {
  const schedule = buildSchedule(settings, 'recovery');
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].id, RECOVERY_BLOCK_ID);
  assert.equal(schedule[0].jumps, 0);

  const day = dayWith('2026-05-12', [RECOVERY_BLOCK_ID], null, 'recovery');
  const totals = computeTotals(day, settings);
  assert.equal(totals.doneBlocks, 1, 'un repos validé est une journée active');
  assert.equal(totals.jumps, 0);
  assert.equal(totals.onPlan, true, 'le repos choisi est une journée tenue');
  assert.equal(totals.targetJumps, 0);

  // Tant qu'il n'est pas coché, le repos ne compte pas : il reste une intention.
  assert.equal(computeTotals(emptyDay('2026-05-12', null, 'recovery'), settings).onPlan, false);

  // Le bloc de récup a son propre identifiant : les blocs de travail déjà
  // saisis survivent à un aller-retour Frais → Récup → Frais.
  const worked = dayWith('2026-05-12', ['0', '1'], 96);
  const paused = { ...worked, state: 'recovery' as DayState };
  assert.equal(computeTotals(paused, settings).jumps, 0);
  assert.equal(computeTotals({ ...paused, state: 'fresh' }, settings).jumps, 300);
});

test('un jour de récup compte dans la série', () => {
  const today = todayISO();
  const days = [
    dayWith(addDays(today, -1), [RECOVERY_BLOCK_ID], null, 'recovery'),
    dayWith(addDays(today, -2), ['0']),
  ];
  assert.equal(currentStreak(days, settings), 2);
});

test('un joker protège la série d’une journée vide', () => {
  const today = todayISO();
  // Rien avant-hier : le trou est couvert, la série tient sans le compter.
  const days = [dayWith(addDays(today, -1), ['0']), dayWith(addDays(today, -3), ['0'])];
  const info = streakInfo(days, settings);
  assert.equal(info.days, 2, 'un joker protège, il ne s’entraîne pas à ta place');
  assert.equal(info.jokersUsed, 1);
  assert.equal(info.jokersLeft, 1);
});

test('le troisième jour vide du mois casse la série', () => {
  // Dates fixes en milieu de mois : le décompte des jokers est mensuel.
  const bridged = [
    dayWith('2026-05-20', ['0']),
    dayWith('2026-05-17', ['0']),
    dayWith('2026-05-16', ['0']),
  ];
  assert.equal(longestStreak(bridged, settings), 3, 'deux jours vides tiennent dans les jokers du mois');

  const broken = [
    dayWith('2026-05-20', ['0']),
    dayWith('2026-05-16', ['0']),
    dayWith('2026-05-15', ['0']),
  ];
  assert.equal(longestStreak(broken, settings), 2, 'trois jours vides dépassent les deux jokers');
});

test('sans série vivante, aucun joker n’est décompté', () => {
  const info = streakInfo([dayWith('2026-05-20', ['0'])], settings);
  assert.equal(info.days, 0);
  assert.equal(info.jokersLeft, 2);
});

test('dépasser son niveau n’est pas le tenir', () => {
  // Le scénario du trou : journée pleine réellement faite, puis rebasculée en
  // « Ménagé » après coup pour la faire passer pour une journée ménagée.
  const full = dayWith('2026-05-12', ['0', '1', '2', '3', '4', '5', '6']);
  const relabelled = { ...full, state: 'spent' as DayState };
  const totals = computeTotals(relabelled, settings);

  assert.equal(totals.jumps, 1000);
  assert.equal(totals.targetJumps, 500);
  assert.equal(totals.overshot, true);
  assert.equal(totals.onPlan, false, 'rebasculer après coup ne rapporte plus rien');

  // La fourchette laisse passer un léger dépassement : 15 % de marge.
  const barely = dayWith('2026-05-12', ['0', '1', '2', '3', '4', '5', '6'], null, 'spent');
  barely.blocks['0'].jumps = 130; // 500 → 555, sous le plafond de 575
  const within = computeTotals(barely, settings);
  assert.equal(within.overshot, false);
  assert.equal(within.onPlan, true);
});

test('une journée qui porte du travail validé ne peut pas être un repos', () => {
  assert.equal(hasLoggedWork(dayWith('2026-05-12', ['0'])), true);
  assert.equal(hasLoggedWork(emptyDay('2026-05-12')), false);
  // Le bloc de récup lui-même ne compte pas comme du travail.
  assert.equal(
    hasLoggedWork(dayWith('2026-05-12', [RECOVERY_BLOCK_ID], null, 'recovery')),
    false,
  );
  // Un bloc saisi mais non validé reste une intention.
  const intent = emptyDay('2026-05-12');
  intent.blocks['0'] = { blockId: '0', done: false, touched: true, time: null, timeAuto: false, jumps: 150, pushups: 0, squats: 0 };
  assert.equal(hasLoggedWork(intent), false);
});

test('six journées tenues d’affilée débloquent un jour ménagé', () => {
  const from = '2026-05-20';
  const held = Array.from({ length: LIGHT_DAY_AFTER }, (_, index) =>
    dayWith(addDays(from, -(index + 1)), ['0', '1', '2', '3', '4', '5', '6']),
  );
  const earned = lightDay(held, settings, from);
  assert.equal(earned.run, LIGHT_DAY_AFTER);
  assert.equal(earned.earned, true);

  // Une journée non tenue interrompt le décompte.
  const broken = [...held.slice(0, 3), dayWith(addDays(from, -4), ['0'])];
  assert.equal(lightDay(broken, settings, from).run, 3);
  assert.equal(lightDay(broken, settings, from).earned, false);

  // Un jour de récup n'alimente pas le compteur : c'est déjà de la décharge.
  const rested = [
    dayWith(addDays(from, -1), [RECOVERY_BLOCK_ID], null, 'recovery'),
    ...held.slice(1),
  ];
  assert.equal(lightDay(rested, settings, from).run, 0);
});

test('les jokers qui ont agi sont nommés', () => {
  const today = todayISO();
  const days = [dayWith(addDays(today, -1), ['0']), dayWith(addDays(today, -3), ['0'])];
  const info = streakInfo(days, settings);
  assert.deepEqual(info.bridged, [addDays(today, -2)], 'la journée franchie est citable');

  // Sans trou, aucun joker n'est annoncé.
  const solid = [dayWith(addDays(today, -1), ['0']), dayWith(addDays(today, -2), ['0'])];
  assert.deepEqual(streakInfo(solid, settings).bridged, []);
});

test('les records comptent les jours tenus, pas seulement les pics', () => {
  const days = [
    dayWith('2026-05-18', ['0', '1', '2', '3', '4', '5', '6']),
    dayWith('2026-05-19', ['0', '1', '2', '3', '4', '5', '6'], null, 'spent'),
    dayWith('2026-05-20', ['0']),
  ];
  const records = allTimeRecords(days, settings);
  assert.equal(records.onPlanDaysEver, 2, 'la journée ménagée tenue compte autant que la pleine');
  assert.equal(records.activeDaysEver, 3);
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
  assert.match(lines[0], /^﻿Date;État;Heures des blocs faits;/);
  assert.match(lines[1], /"Genou sensible; repos demain"$/);
  assert.match(lines[1], /^2026-09-10;Plein;07:42;1;7;150;20;20;/);
});

test('l’état du jour survit à l’export et aux sauvegardes qui l’ignorent', () => {
  const days = [
    dayWith('2026-09-09', ['0', '1'], 96, 'spent'),
    dayWith('2026-09-10', [RECOVERY_BLOCK_ID], 95.5, 'recovery'),
  ];
  const parsed = parseBackup(JSON.stringify(buildPayload(days, settings)));
  assert.equal(parsed.days[0].state, 'spent');
  assert.equal(parsed.days[1].state, 'recovery');
  assert.equal(computeTotals(parsed.days[1], settings).onPlan, true);

  // Sauvegarde antérieure à l'état du jour : elle repart en « Frais », donc
  // avec exactement les mêmes chiffres qu'avant.
  const legacy = parseBackup(
    JSON.stringify({ days: [{ date: '2026-09-09', weight: 96, notes: '', blocks: [] }] }),
  );
  assert.equal(legacy.days[0].state, 'fresh');
  assert.equal(normalizeDayState('n’importe quoi'), 'fresh');
});
