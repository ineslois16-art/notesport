import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  blockCalories,
  blockSeconds,
  clockToMinutes,
  describeEffort,
  displayTime,
  formatClock,
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

/** « HH:MM » → objet Date du jour, seul format accepté par le sélecteur natif. */
function clockToDate(clock: string): Date {
  const minutes = clockToMinutes(clock) ?? 0;
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

type Props = {
  block: PlannedBlock;
  entry: BlockEntry;
  cadence: number;
  weight: number;
  expanded: boolean;
  /** Le bloc attend une validation explicite : rien n'est encore enregistré. */
  confirming: boolean;
  onAskConfirm: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onUndo: () => void;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<Effort>) => void;
  onChangeTime: (time: string | null) => void;
  onReset: () => void;
};

export function BlockRow({
  block,
  entry,
  cadence,
  weight,
  expanded,
  confirming,
  onAskConfirm,
  onConfirm,
  onCancelConfirm,
  onUndo,
  onToggleExpanded,
  onChange,
  onChangeTime,
  onReset,
}: Props) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const seconds = blockSeconds(entry, cadence);
  const kcal = blockCalories(entry, weight, cadence);
  const adjusted =
    entry.jumps !== block.jumps || entry.pushups !== block.pushups || entry.squats !== block.squats;
  const time = displayTime(entry, block);
  const movedFromPlan = entry.time !== null && entry.time !== block.label;

  // Cocher demande une validation ; décocher est immédiat — on défait, on ne
  // crée rien, et un accord pour annuler une erreur serait pénible.
  const handleTick = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (entry.done) onUndo();
    else onAskConfirm();
  };

  const handleConfirm = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  const handlePicked = (event: DateTimePickerEvent, value?: Date) => {
    // Android : le sélecteur est une boîte de dialogue, elle se referme seule.
    if (Platform.OS === 'android') setPicking(false);
    if (event.type === 'dismissed' || !value) return;
    onChangeTime(formatClock(value.getHours(), value.getMinutes()));
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: entry.done ? theme.brandSoft : 'transparent' }]}>
      <View style={styles.main}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entry.done }}
          accessibilityLabel={`Bloc de ${time}, ${describeEffort(entry)}`}
          onPress={handleTick}
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
          accessibilityLabel={expanded ? 'Masquer le détail du bloc' : "Ajuster l'heure et les répétitions"}
          onPress={onToggleExpanded}
          style={styles.body}>
          <View style={styles.titleLine}>
            <Text style={[typography.strong, { color: theme.ink }]}>{time}</Text>
            {movedFromPlan ? (
              <Text style={[typography.tiny, { color: theme.inkMuted }]}>repère {block.label}</Text>
            ) : null}
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
          {confirming ? (
            <Text style={[typography.strong, { color: theme.berry }]}>Vérifie avant de valider</Text>
          ) : null}
          <View style={styles.detailRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.small, { color: theme.inkSoft }]}>Heure réelle</Text>
              <Text style={[typography.tiny, { color: theme.inkMuted }]}>repère {block.label}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Modifier l'heure du bloc, actuellement ${time}`}
              onPress={() => setPicking((value) => !value)}
              style={({ pressed }) => [
                styles.timeChip,
                { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={[typography.strong, { color: theme.ink }]}>{time}</Text>
            </Pressable>
          </View>

          {picking ? (
            <View style={styles.picker}>
              <DateTimePicker
                value={clockToDate(time)}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handlePicked}
              />
              {Platform.OS === 'ios' ? (
                <Pressable accessibilityRole="button" onPress={() => setPicking(false)} hitSlop={6}>
                  <Text style={[typography.small, { color: theme.brand, fontWeight: '700', textAlign: 'center' }]}>
                    Terminé
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

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

          {confirming ? (
            <View style={styles.confirmRow}>
              <Pressable
                accessibilityRole="button"
                onPress={onCancelConfirm}
                style={({ pressed }) => [
                  styles.confirmNo,
                  { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={[typography.strong, { color: theme.ink }]}>Annuler</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.confirmYes,
                  { backgroundColor: theme.brandDeep, opacity: pressed ? 0.8 : 1 },
                ]}>
                <Text style={[typography.strong, { color: theme.brandInk }]}>Valider ce bloc ✓</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPicking(false);
                onReset();
              }}
              style={styles.resetTap}
              hitSlop={6}>
              <Text style={[typography.small, { color: theme.inkMuted, textDecorationLine: 'underline' }]}>
                Revenir à l’heure et aux valeurs prévues
              </Text>
            </Pressable>
          )}
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
  timeChip: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 42,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: { gap: spacing.xs },
  resetTap: { alignSelf: 'flex-start', paddingVertical: 6 },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  confirmNo: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  confirmYes: { flex: 2, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
});
