import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { configureNotifications, syncReminders } from './src/lib/reminders';
import { todayISO, type ISODate } from './src/lib/dates';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { StoreProvider, useStore } from './src/state/store';
import { spacing, type as typography, useTheme } from './src/theme';

configureNotifications();

type TabKey = 'today' | 'progress' | 'history' | 'settings';

const ICONS: Record<TabKey, string> = {
  today: 'M4 7.5h16M7 3.5v3M17 3.5v3M4.8 4.5h14.4a.8.8 0 0 1 .8.8v13.4a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8V5.3a.8.8 0 0 1 .8-.8ZM8.5 13.6l2.2 2.2 4.6-4.6',
  progress: 'M4 19.5V4.5M4 19.5h16M7.5 15.5l3.5-4.2 3 2.4 4.5-5.7',
  history: 'M4 12a8 8 0 1 0 2.6-5.9M4 4.6v3.9h3.9M12 7.6V12l3 1.8',
  settings: 'M6.5 5.5v13M17.5 5.5v13M3.5 9.5h6M14.5 14.5h6',
};

const LABELS: Record<TabKey, string> = {
  today: "Aujourd'hui",
  progress: 'Progression',
  history: 'Historique',
  settings: 'Réglages',
};

function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}>
      {(Object.keys(ICONS) as TabKey[]).map((key) => {
        const selected = key === active;
        const color = selected ? theme.brand : theme.inkMuted;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={LABELS[key]}
            onPress={() => onChange(key)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}>
            <Svg width={23} height={23} viewBox="0 0 24 24">
              <Path
                d={ICONS[key]}
                stroke={color}
                strokeWidth={selected ? 2.1 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
            <Text style={[typography.tiny, { color, marginTop: 3 }]} numberOfLines={1}>
              {LABELS[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shell() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, error, settings, date, setDate } = useStore();
  const [tab, setTab] = useState<TabKey>('today');
  const dateRef = useRef(date);
  dateRef.current = date;

  // Rappels reprogrammés au lancement : l'iOS peut les avoir purgés.
  useEffect(() => {
    if (ready && settings.remindersEnabled) void syncReminders(settings);
  }, [ready, settings]);

  // Retour au premier plan après minuit : on bascule sur la nouvelle journée.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const today = todayISO();
      if (dateRef.current < today) setDate(today);
    });
    return () => subscription.remove();
  }, [setDate]);

  const openDay = (target: ISODate) => {
    setDate(target);
    setTab('today');
  };

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg, padding: spacing.xl }]}>
        <Text style={[typography.title, { color: theme.ink, textAlign: 'center', marginBottom: spacing.sm }]}>
          Base locale inaccessible
        </Text>
        <Text style={[typography.small, { color: theme.inkMuted, textAlign: 'center' }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.screen}>
        {tab === 'today' ? <TodayScreen /> : null}
        {tab === 'progress' ? <ProgressScreen /> : null}
        {tab === 'history' ? <HistoryScreen onOpenDay={openDay} /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        {/* Le thème est sombre en permanence : la barre système suit, sans deviner. */}
        <StatusBar style="light" />
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
});
