import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { Card, Chip, EmptyState, Metric, Muted, Row, SectionTitle } from '../components/ui';
import { readAllDays } from '../db/database';
import { formatDuration, formatNumber, type DayRecord } from '../domain/program';
import {
  allTimeRecords,
  buildDayPoints,
  currentStreak,
  firstLastDelta,
  longestStreak,
  summarize,
} from '../domain/stats';
import { addDays, formatDayMonth, formatShort, todayISO } from '../lib/dates';
import { useStore } from '../state/store';
import { radius, spacing, type as typography, useTheme } from '../theme';

const RANGES = [
  { label: '7 j', days: 7 },
  { label: '30 j', days: 30 },
  { label: '90 j', days: 90 },
  { label: '1 an', days: 365 },
];

export function ProgressScreen() {
  const theme = useTheme();
  const { settings, revision } = useStore();
  const [days, setDays] = useState<DayRecord[] | null>(null);
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    readAllDays()
      .then((records) => {
        if (!cancelled) setDays(records);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const today = todayISO();
  const from = addDays(today, -(rangeDays - 1));
  const previousFrom = addDays(from, -rangeDays);
  const previousTo = addDays(from, -1);

  const points = useMemo(
    () => (days ? buildDayPoints(days, settings, from, today) : []),
    [days, settings, from, today],
  );
  const previousPoints = useMemo(
    () => (days ? buildDayPoints(days, settings, previousFrom, previousTo) : []),
    [days, settings, previousFrom, previousTo],
  );

  const summary = useMemo(() => summarize(points), [points]);
  const previousSummary = useMemo(() => summarize(previousPoints), [previousPoints]);
  const streak = useMemo(() => (days ? currentStreak(days, settings) : 0), [days, settings]);
  const best = useMemo(() => (days ? longestStreak(days, settings) : 0), [days, settings]);
  const records = useMemo(
    () => (days ? allTimeRecords(days, settings) : null),
    [days, settings],
  );

  // Au-delà de ~90 jours, une étiquette par jour serait illisible : on garde le
  // jour comme unité mais on n'affiche que quelques repères (géré par le graphe).
  const labelOf = rangeDays <= 31 ? formatShort : formatDayMonth;

  const jumpPoints = points.map((point) => ({ label: labelOf(point.date), value: point.totals.jumps }));
  const blockPoints = points.map((point) => ({
    label: labelOf(point.date),
    value: point.totals.doneBlocks,
    capacity: point.totals.blockCount,
  }));
  const kcalPoints = points.map((point) => ({ label: labelOf(point.date), value: point.totals.kcal }));
  const weightPoints = points.map((point) => ({ label: labelOf(point.date), value: point.weight }));
  const weightDelta = firstLastDelta(points.map((point) => point.weight));

  const jumpsDelta = summary.totalJumps - previousSummary.totalJumps;
  const deltaLabel =
    previousSummary.totalJumps > 0
      ? `${jumpsDelta >= 0 ? '+' : '−'}${formatNumber(Math.abs(jumpsDelta))} vs période précédente`
      : 'Première période enregistrée';

  if (days === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  const hasAnything = days.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[typography.title, { color: theme.ink, marginBottom: spacing.md }]}>Progression</Text>

      <Row style={{ marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        {RANGES.map((range) => (
          <Chip
            key={range.days}
            label={range.label}
            selected={rangeDays === range.days}
            onPress={() => setRangeDays(range.days)}
          />
        ))}
      </Row>

      {!hasAnything ? (
        <Card>
          <EmptyState
            title="Rien à tracer pour l’instant"
            body="Coche un premier bloc dans l’onglet Aujourd’hui : les courbes se remplissent ensuite toutes seules."
          />
        </Card>
      ) : (
        <>
          <Card>
            <Muted>Sauts sur la période</Muted>
            <Text style={[styles.hero, { color: theme.ink }]}>{formatNumber(summary.totalJumps)}</Text>
            <Text
              style={[
                typography.small,
                { color: jumpsDelta >= 0 ? theme.brand : theme.inkMuted, fontWeight: '700' },
              ]}>
              {deltaLabel}
            </Text>

            <Row style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Metric
                value={`${streak} j`}
                label="série en cours"
                accent={streak > 0 ? theme.plum : undefined}
                hint={best > 0 ? `record ${best} j` : undefined}
              />
              <Metric value={`${summary.consistency} %`} label="régularité" hint={`${summary.activeDays} j actifs`} />
              <Metric value={formatNumber(summary.averageJumps)} label="sauts / jour" />
            </Row>
            <Row style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              <Metric value={formatNumber(summary.totalKcal)} label="kcal cumulées" accent={theme.series.kcal} />
              <Metric value={formatDuration(summary.totalSeconds)} label="temps actif" />
              <Metric value={`${summary.targetHitDays}`} label="objectifs atteints" accent={theme.plum} />
            </Row>
          </Card>

          <View style={{ height: spacing.lg }} />
          <SectionTitle>Courbes</SectionTitle>

          <Card>
            <LineChart
              title="Sauts par jour"
              points={jumpPoints}
              color={theme.series.jumps}
              unit="sauts"
              formatValue={(value) => formatNumber(value)}
              reference={
                settings.dailyJumpTarget > 0
                  ? { value: settings.dailyJumpTarget, label: `objectif ${formatNumber(settings.dailyJumpTarget)}` }
                  : undefined
              }
            />
          </Card>

          <View style={{ height: spacing.md }} />

          <Card>
            <BarChart
              title="Blocs terminés"
              points={blockPoints}
              color={theme.series.blocks}
              unit="blocs"
            />
          </Card>

          <View style={{ height: spacing.md }} />

          <Card>
            <LineChart
              title="Poids"
              points={weightPoints}
              color={theme.series.weight}
              unit="kg"
              fromZero={false}
              connectGaps
              formatValue={(value) => value.toFixed(1).replace('.', ',')}
              emptyMessage="Renseigne ton poids dans l’onglet Aujourd’hui pour voir la courbe."
            />
            {weightDelta ? (
              <View style={[styles.footnote, { borderTopColor: theme.line }]}>
                <Text style={[typography.small, { color: theme.inkSoft }]}>
                  {weightDelta.first.toFixed(1).replace('.', ',')} kg →{' '}
                  {weightDelta.last.toFixed(1).replace('.', ',')} kg
                </Text>
                <Text
                  style={[
                    typography.small,
                    { color: weightDelta.delta <= 0 ? theme.brand : theme.inkSoft, fontWeight: '700' },
                  ]}>
                  {weightDelta.delta > 0 ? '+' : '−'}
                  {Math.abs(weightDelta.delta).toFixed(1).replace('.', ',')} kg
                </Text>
              </View>
            ) : null}
          </Card>

          <View style={{ height: spacing.md }} />

          <Card>
            <LineChart
              title="Dépense estimée"
              points={kcalPoints}
              color={theme.series.kcal}
              unit="kcal"
              formatValue={(value) => formatNumber(value)}
            />
          </Card>

          {records ? (
            <>
              <View style={{ height: spacing.lg }} />
              <SectionTitle>Records personnels</SectionTitle>
              <Card>
                <RecordLine
                  label="Meilleure journée"
                  value={records.bestJumps ? `${formatNumber(records.bestJumps.value)} sauts` : '—'}
                  hint={records.bestJumps ? formatShort(records.bestJumps.date) : undefined}
                />
                <RecordLine
                  label="Plus grosse dépense"
                  value={records.bestKcal ? `${formatNumber(records.bestKcal.value)} kcal` : '—'}
                  hint={records.bestKcal ? formatShort(records.bestKcal.date) : undefined}
                />
                <RecordLine
                  label="Total depuis le début"
                  value={`${formatNumber(records.totalJumpsEver)} sauts`}
                  hint={`${records.activeDaysEver} journée(s) active(s)`}
                />
                <RecordLine label="Plus longue série" value={`${best} jour(s)`} last />
              </Card>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function RecordLine({
  label,
  value,
  hint,
  last,
}: {
  label: string;
  value: string;
  hint?: string;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.recordLine,
        { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.line },
      ]}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: theme.ink }]}>{label}</Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Text style={[typography.strong, { color: theme.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, lineHeight: 48, marginVertical: 2 },
  footnote: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  recordLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.sm },
});
