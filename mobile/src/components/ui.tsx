import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, type as typography, useTheme } from '../theme';

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.line,
          shadowColor: theme.shadow,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[typography.section, { color: theme.inkMuted, textTransform: 'uppercase' }]}>{children}</Text>
      {action}
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[typography.small, { color: theme.inkMuted }, style]}>{children}</Text>;
}

export function Metric({
  value,
  label,
  accent,
  hint,
}: {
  value: string;
  label: string;
  accent?: string;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: theme.surfaceAlt }]}>
      <Text style={[styles.metricValue, { color: accent ?? theme.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[typography.tiny, { color: theme.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text style={[typography.tiny, { color: theme.inkMuted, opacity: 0.8, marginTop: 2 }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, color, height = 10 }: { value: number; color?: string; height?: number }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSunken, height, borderRadius: height }]}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height,
          backgroundColor: color ?? theme.brand,
        }}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  compact,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingVertical: compact ? 6 : spacing.sm,
          backgroundColor: selected ? theme.brandDeep : theme.surfaceAlt,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}>
      <Text
        style={[
          typography.small,
          { color: selected ? theme.brandInk : theme.inkSoft, fontWeight: '700' },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'secondary', disabled, busy, style }: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.brandDeep, fg: theme.brandInk },
    secondary: { bg: theme.surfaceAlt, fg: theme.ink },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <Text style={[typography.strong, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
  width = 128,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  width?: number;
}) {
  const theme = useTheme();
  const apply = (delta: number) => {
    const next = Math.round((value + delta) * 100) / 100;
    onChange(Math.max(min, Math.min(max, next)));
  };
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View style={[styles.stepper, { backgroundColor: theme.surfaceAlt, width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diminuer"
        disabled={!canDecrease}
        onPress={() => apply(-step)}
        hitSlop={6}
        style={({ pressed }) => [styles.stepperButton, { opacity: !canDecrease ? 0.3 : pressed ? 0.6 : 1 }]}>
        <Text style={[styles.stepperSign, { color: theme.ink }]}>−</Text>
      </Pressable>
      <Text style={[typography.strong, { color: theme.ink, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {value}
        {suffix ? <Text style={{ color: theme.inkMuted }}> {suffix}</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Augmenter"
        disabled={!canIncrease}
        onPress={() => apply(step)}
        hitSlop={6}
        style={({ pressed }) => [styles.stepperButton, { opacity: !canIncrease ? 0.3 : pressed ? 0.6 : 1 }]}>
        <Text style={[styles.stepperSign, { color: theme.ink }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line, marginVertical: spacing.md }} />;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[typography.strong, { color: theme.ink, marginBottom: 4, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.small, { color: theme.inkMuted, textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 2 },
      default: {},
    }),
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  metric: {
    flex: 1,
    minWidth: 74,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  metricValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  progressTrack: { width: '100%', overflow: 'hidden' },
  chip: { borderRadius: radius.pill },
  button: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, height: 42 },
  stepperButton: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  empty: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center' },
});
