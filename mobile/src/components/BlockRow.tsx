import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  blockCalories,
  blockSeconds,
  describeEffort,
  formatDuration,
  type BlockEntry,
  type Effort,
  type PlannedBlock,
} from '../domain/program';
import { radius, spacing, type as typography, useTheme } from '../theme';
import { Stepper } from './ui';

function CheckMark({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M3 8.6 6.2 12 13 4.6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

type Props = {
  block: PlannedBlock;
  entry: BlockEntry;
  cadence: number;
  weight: number;
  expanded: boolean;
  onToggleDone: () => void;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<Effort>) => void;
  onReset: () => void;
};

export function BlockRow({
  block,
  entry,
  cadence,
  weight,
  expanded,
  onToggleDone,
  onToggleExpanded,
  onChange,
  onReset,
}: Props) {
  const theme = useTheme();
  const seconds = blockSeconds(entry, cadence);
  const kcal = blockCalories(entry, weight, cadence);
  const adjusted =
    entry.jumps !== block.jumps || entry.pushups !== block.pushups || entry.squats !== block.squats;

  const handleToggle = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(
        entry.done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      );
    }
    onToggleDone();
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: entry.done ? theme.brandSoft : 'transparent' }]}>
      <View style={styles.main}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entry.done }}
          accessibilityLabel={`Bloc de ${block.label}, ${describeEffort(entry)}`}
          onPress={handleToggle}
          hitSlop={6}
          style={styles.checkTap}>
          <View
            style={[
              styles.check,
              {
                borderColor: entry.done ? theme.brand : theme.line,
                backgroundColor: entry.done ? theme.brand : 'transparent',
              },
            ]}>
            {entry.done ? <CheckMark color={theme.brandInk} /> : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Masquer le détail du bloc' : 'Ajuster les répétitions'}
          onPress={onToggleExpanded}
          style={styles.body}>
          <View style={styles.titleLine}>
            <Text style={[typography.strong, { color: theme.ink }]}>{block.label}</Text>
            {adjusted ? (
              <View style={[styles.badge, { backgroundColor: theme.surfaceAlt }]}>
                <Text style={[typography.tiny, { color: theme.inkMuted }]}>ajusté</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.small, { color: theme.inkSoft }]} numberOfLines={1}>
            {describeEffort(entry)}
          </Text>
        </Pressable>

        <View style={styles.stats}>
          <Text style={[typography.small, { color: theme.ink, fontWeight: '700' }]}>{formatDuration(seconds)}</Text>
          <Text style={[typography.tiny, { color: theme.inkMuted }]}>~{kcal} kcal</Text>
        </View>
      </View>

      {expanded ? (
        <View style={[styles.detail, { borderTopColor: theme.line }]}>
          <View style={styles.detailRow}>
            <Text style={[typography.small, { color: theme.inkSoft, flex: 1 }]}>Sauts de corde</Text>
            <Stepper value={entry.jumps} step={10} max={5000} onChange={(jumps) => onChange({ jumps })} />
          </View>
          <View style={styles.detailRow}>
            <Text style={[typography.small, { color: theme.inkSoft, flex: 1 }]}>Pompes</Text>
            <Stepper value={entry.pushups} step={5} max={1000} onChange={(pushups) => onChange({ pushups })} />
          </View>
          <View style={styles.detailRow}>
            <Text style={[typography.small, { color: theme.inkSoft, flex: 1 }]}>Squats</Text>
            <Stepper value={entry.squats} step={5} max={1000} onChange={(squats) => onChange({ squats })} />
          </View>
          <Pressable accessibilityRole="button" onPress={onReset} style={styles.resetTap} hitSlop={6}>
            <Text style={[typography.small, { color: theme.inkMuted, textDecorationLine: 'underline' }]}>
              Revenir aux valeurs prévues
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: radius.md, marginBottom: 2 },
  main: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingRight: spacing.sm },
  checkTap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingVertical: 4, paddingRight: spacing.sm },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 1 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  stats: { alignItems: 'flex-end', minWidth: 68 },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resetTap: { alignSelf: 'flex-start', paddingVertical: 6 },
});
