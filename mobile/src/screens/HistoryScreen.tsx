import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, Muted, ProgressBar } from '../components/ui';
import { readAllDays } from '../db/database';
import { computeTotals, formatNumber, type DayRecord } from '../domain/program';
import { formatMonthTitle, monthKey, weekdayLetter, type ISODate } from '../lib/dates';
import { useStore } from '../state/store';
import { radius, spacing, type as typography, useTheme } from '../theme';

type Section = { title: string; data: DayRecord[] };

export function HistoryScreen({ onOpenDay }: { onOpenDay: (date: ISODate) => void }) {
  const theme = useTheme();
  const { settings, revision } = useStore();
  const [days, setDays] = useState<DayRecord[] | null>(null);

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

  const sections = useMemo<Section[]>(() => {
    if (!days) return [];
    const withActivity = days
      .filter((day) => {
        const totals = computeTotals(day, settings);
        return totals.doneBlocks > 0 || totals.jumps > 0 || day.weight != null || day.notes.trim().length > 0;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const grouped = new Map<string, DayRecord[]>();
    for (const day of withActivity) {
      const key = monthKey(day.date);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(day);
      else grouped.set(key, [day]);
    }
    return [...grouped.entries()].map(([key, data]) => ({
      title: formatMonthTitle(`${key}-01`),
      data,
    }));
  }, [days, settings]);

  if (days === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (!sections.length) {
    return (
      <View style={styles.content}>
        <Text style={[typography.title, { color: theme.ink, marginBottom: spacing.lg }]}>Historique</Text>
        <Card>
          <EmptyState
            title="Aucune séance enregistrée"
            body="Chaque journée où tu coches au moins un bloc apparaîtra ici, du plus récent au plus ancien."
          />
        </Card>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.date}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Text style={[typography.title, { color: theme.ink, marginBottom: spacing.md }]}>Historique</Text>
      }
      renderSectionHeader={({ section }) => (
        <Text style={[typography.section, { color: theme.inkMuted, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          {section.title.toUpperCase()}
        </Text>
      )}
      renderItem={({ item }) => {
        const totals = computeTotals(item, settings);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir le ${item.date}`}
            onPress={() => onOpenDay(item.date)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.surface, borderColor: theme.line, opacity: pressed ? 0.7 : 1 },
            ]}>
            <View style={[styles.dayBadge, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={[typography.tiny, { color: theme.inkMuted }]}>{weekdayLetter(item.date)}</Text>
              <Text style={[styles.dayNumber, { color: theme.ink }]}>{Number(item.date.slice(8, 10))}</Text>
            </View>

            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.rowTop}>
                <Text style={[typography.strong, { color: theme.ink }]}>
                  {totals.doneBlocks}/{totals.blockCount} blocs
                </Text>
                <Text style={[typography.small, { color: theme.inkSoft }]}>
                  {formatNumber(totals.jumps)} sauts · {formatNumber(totals.kcal)} kcal
                </Text>
              </View>
              <ProgressBar value={totals.percent / 100} height={6} />
              {item.notes.trim() ? (
                <Muted style={{ marginTop: 2 }} >
                  {item.notes.trim().length > 70 ? `${item.notes.trim().slice(0, 70)}…` : item.notes.trim()}
                </Muted>
              ) : null}
            </View>

            <View style={styles.weight}>
              <Text style={[typography.small, { color: theme.ink, fontWeight: '700' }]}>
                {item.weight != null ? `${String(item.weight).replace('.', ',')}` : '—'}
              </Text>
              <Text style={[typography.tiny, { color: theme.inkMuted }]}>kg</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  dayBadge: { width: 44, borderRadius: radius.md, paddingVertical: 6, alignItems: 'center' },
  dayNumber: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  weight: { alignItems: 'flex-end', minWidth: 34 },
});
