import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BlockRow } from '../components/BlockRow';
import { ProgressRing } from '../components/ProgressRing';
import { Button, Card, Metric, Muted, ProgressBar, Row, SectionTitle } from '../components/ui';
import { clockToMinutes, describeEffort, displayTime, entryFor, formatDuration, formatNumber } from '../domain/program';
import { addDays, formatDayTitle, formatShort, isFuture, isToday, todayISO } from '../lib/dates';
import { useStore } from '../state/store';
import { radius, spacing, type as typography, useTheme } from '../theme';

function Chevron({ direction, color }: { direction: 'left' | 'right'; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d={direction === 'left' ? 'M11.5 3.5 6 9l5.5 5.5' : 'M6.5 3.5 12 9l-5.5 5.5'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function TodayScreen() {
  const theme = useTheme();
  const {
    date,
    setDate,
    day,
    schedule,
    settings,
    totals,
    toggleBlock,
    setBlockEffort,
    setBlockTime,
    resetBlock,
    setDayMeta,
  } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weightText, setWeightText] = useState('');

  useEffect(() => {
    setWeightText(day.weight != null ? String(day.weight) : '');
    setExpanded(null);
  }, [day.date, day.weight]);

  const weight = day.weight ?? settings.defaultWeight;
  const jumpProgress = totals.targetJumps > 0 ? totals.jumps / totals.targetJumps : 0;
  const remainingJumps = Math.max(0, totals.targetJumps - totals.jumps);

  const nextBlock = useMemo(() => {
    if (!isToday(date)) return null;
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const minutesOf = (block: (typeof schedule)[number]) =>
      clockToMinutes(displayTime(entryFor(day, block), block)) ?? block.hour * 60 + block.minute;
    return (
      schedule.find((block) => !entryFor(day, block).done && minutesOf(block) >= now) ??
      schedule.find((block) => !entryFor(day, block).done) ??
      null
    );
  }, [date, day, schedule]);

  const commitWeight = (text: string) => {
    setWeightText(text);
    const parsed = Number(text.replace(',', '.'));
    if (!text.trim()) {
      setDayMeta({ weight: null });
    } else if (Number.isFinite(parsed) && parsed >= 20 && parsed <= 300) {
      setDayMeta({ weight: Math.round(parsed * 10) / 10 });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.dateBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jour précédent"
          onPress={() => setDate(addDays(date, -1))}
          style={({ pressed }) => [styles.navButton, { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 }]}>
          <Chevron direction="left" color={theme.ink} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revenir à aujourd'hui"
          onPress={() => setDate(todayISO())}
          style={styles.dateLabel}>
          <Text style={[typography.title, { color: theme.ink }]} numberOfLines={1}>
            {formatDayTitle(date)}
          </Text>
          <Muted>{formatShort(date)}</Muted>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jour suivant"
          disabled={isFuture(addDays(date, 1))}
          onPress={() => setDate(addDays(date, 1))}
          style={({ pressed }) => [
            styles.navButton,
            {
              backgroundColor: theme.surface,
              opacity: isFuture(addDays(date, 1)) ? 0.35 : pressed ? 0.6 : 1,
            },
          ]}>
          <Chevron direction="right" color={theme.ink} />
        </Pressable>
      </View>

      <Card>
        <Row style={{ gap: spacing.lg, marginBottom: spacing.md }}>
          <ProgressRing done={totals.doneBlocks} total={totals.blockCount} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.big, { color: theme.ink }]}>{formatNumber(totals.jumps)}</Text>
            <Muted>/ {formatNumber(totals.targetJumps)} sauts</Muted>
            <View style={{ height: spacing.md }} />
            <ProgressBar value={jumpProgress} color={theme.series.jumps} height={8} />
            <Muted style={{ marginTop: 6 }}>
              {remainingJumps > 0 ? `${formatNumber(remainingJumps)} sauts restants` : 'objectif atteint 🎉'}
            </Muted>
          </View>
        </Row>

        <Row style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Metric value={formatNumber(totals.pushups + totals.squats)} label="pompes + squats" />
          <Metric value={`${formatNumber(totals.kcal)}`} label="kcal estimées" accent={theme.series.kcal} />
          <Metric value={formatDuration(totals.seconds)} label="temps actif" />
        </Row>

        {nextBlock ? (
          <View style={[styles.nextHint, { backgroundColor: theme.berrySoft }]}>
            <Text style={[typography.small, { color: theme.berry, fontWeight: '700' }]}>
              Prochain bloc · {displayTime(entryFor(day, nextBlock), nextBlock)}
            </Text>
            <Text style={[typography.small, { color: theme.inkSoft }]}>{describeEffort(nextBlock)}</Text>
          </View>
        ) : null}
      </Card>

      <View style={{ height: spacing.lg }} />

      <SectionTitle action={<Muted>Touche une ligne pour ajuster</Muted>}>Blocs de la journée</SectionTitle>
      <Card padded={false} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}>
        {schedule.map((block) => {
          const entry = entryFor(day, block);
          return (
            <BlockRow
              key={block.id}
              block={block}
              entry={entry}
              cadence={settings.cadence}
              weight={weight}
              expanded={expanded === block.id}
              onToggleDone={() => void toggleBlock(block.id)}
              onToggleExpanded={() => setExpanded((value) => (value === block.id ? null : block.id))}
              onChange={(patch) => void setBlockEffort(block.id, patch)}
              onChangeTime={(time) => void setBlockTime(block.id, time)}
              onReset={() => void resetBlock(block.id)}
            />
          );
        })}
      </Card>

      <View style={{ height: spacing.lg }} />

      <SectionTitle>Poids et ressenti</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.strong, { color: theme.ink }]}>Poids du jour</Text>
            <Muted>Sert au calcul des calories et à la courbe.</Muted>
          </View>
          <View style={[styles.weightBox, { backgroundColor: theme.surfaceAlt }]}>
            <TextInput
              value={weightText}
              onChangeText={commitWeight}
              keyboardType="decimal-pad"
              placeholder={String(settings.defaultWeight)}
              placeholderTextColor={theme.inkMuted}
              accessibilityLabel="Poids du jour en kilogrammes"
              style={[styles.weightInput, { color: theme.ink }]}
              maxLength={5}
              returnKeyType="done"
            />
            <Text style={[typography.small, { color: theme.inkMuted }]}>kg</Text>
          </View>
        </Row>

        <TextInput
          value={day.notes}
          onChangeText={(notes) => setDayMeta({ notes })}
          multiline
          placeholder="Énergie, douleur inhabituelle, météo…"
          placeholderTextColor={theme.inkMuted}
          accessibilityLabel="Commentaires de la journée"
          style={[
            styles.notes,
            { backgroundColor: theme.surfaceAlt, color: theme.ink, borderColor: theme.line },
          ]}
        />

        {!isToday(date) ? (
          <Button
            label="Revenir à aujourd'hui"
            onPress={() => setDate(todayISO())}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </Card>

      <Text style={[typography.tiny, { color: theme.inkMuted, marginTop: spacing.lg, textAlign: 'center' }]}>
        Enregistrement automatique sur ce téléphone. Les calories sont une estimation d'après le poids, l'intensité et
        le temps actif — pas une mesure médicale.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  dateBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md },
  navButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { flex: 1, alignItems: 'center' },
  big: { fontSize: 38, fontWeight: '800', letterSpacing: -1, lineHeight: 42 },
  nextHint: { marginTop: spacing.lg, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  weightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    gap: 4,
  },
  weightInput: { fontSize: 19, fontWeight: '800', minWidth: 56, textAlign: 'right', paddingVertical: 0 },
  notes: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
