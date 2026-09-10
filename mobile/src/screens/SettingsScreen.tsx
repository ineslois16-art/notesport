import Constants from 'expo-constants';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Divider, Muted, Row, SectionTitle, Stepper } from '../components/ui';
import { deleteEverything, mergeDays, readAllDays, replaceAll, writeSettings } from '../db/database';
import { buildSchedule, formatDuration, formatNumber, type Settings } from '../domain/program';
import { blockCalories, blockSeconds } from '../domain/program';
import { exportCsv, exportJson, parseBackup, pickBackupFile } from '../lib/backup';
import { ensurePermission } from '../lib/reminders';
import { useStore } from '../state/store';
import { radius, spacing, type as typography, useTheme } from '../theme';

type Field = {
  key: keyof Settings;
  label: string;
  hint?: string;
  step: number;
  min: number;
  max: number;
  suffix?: string;
};

const FIELDS: Field[] = [
  { key: 'blockCount', label: 'Nombre de blocs', step: 1, min: 1, max: 24 },
  { key: 'startHour', label: 'Premier bloc', hint: 'heure de démarrage', step: 1, min: 0, max: 23, suffix: 'h' },
  { key: 'intervalHours', label: 'Intervalle', hint: 'entre deux blocs', step: 1, min: 1, max: 12, suffix: 'h' },
  { key: 'jumpsPerBlock', label: 'Sauts par bloc', step: 10, min: 0, max: 2000 },
  { key: 'dailyJumpTarget', label: 'Objectif quotidien', hint: 'sauts par jour', step: 50, min: 0, max: 20000 },
  { key: 'pushupsPerBlock', label: 'Pompes par bloc', step: 5, min: 0, max: 500 },
  { key: 'squatsPerBlock', label: 'Squats par bloc', step: 5, min: 0, max: 500 },
  { key: 'cadence', label: 'Cadence corde', hint: 'sauts par minute', step: 5, min: 30, max: 250 },
  { key: 'defaultWeight', label: 'Poids de référence', hint: 'utilisé si aucune pesée', step: 1, min: 20, max: 300, suffix: 'kg' },
];

export function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings, reload } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  const preview = useMemo(() => {
    const schedule = buildSchedule(settings);
    const seconds = schedule.reduce((total, block) => total + blockSeconds(block, settings.cadence), 0);
    const kcal = schedule.reduce(
      (total, block) => total + blockCalories(block, settings.defaultWeight, settings.cadence),
      0,
    );
    const jumps = schedule.reduce((total, block) => total + block.jumps, 0);
    return { schedule, seconds, kcal, jumps };
  }, [settings]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      Alert.alert('Oups', error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setBusy(null);
    }
  };

  const handleReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensurePermission();
      if (!granted) {
        Alert.alert(
          'Notifications refusées',
          "Autorise les notifications pour cette application dans les réglages du téléphone, puis réessaie.",
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
    }
    await updateSettings({ remindersEnabled: enabled });
  };

  const handleImport = () =>
    run('import', async () => {
      const text = await pickBackupFile();
      if (text === null) return;
      const parsed = parseBackup(text);
      const dayCount = parsed.days.length;

      Alert.alert(
        'Importer la sauvegarde',
        `${dayCount} journée(s) trouvée(s) (format : ${parsed.source}).\n\n« Fusionner » garde tes journées actuelles et écrase seulement celles aux mêmes dates. « Remplacer » efface tout avant d'importer.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Fusionner',
            onPress: () =>
              void run('import', async () => {
                await mergeDays(parsed.days);
                if (parsed.settings) await writeSettings(parsed.settings);
                await reload();
                Alert.alert('Import terminé', `${dayCount} journée(s) ajoutée(s) ou mise(s) à jour.`);
              }),
          },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: () =>
              void run('import', async () => {
                await replaceAll(parsed.days, parsed.settings ?? settings);
                await reload();
                Alert.alert('Import terminé', `${dayCount} journée(s) restaurée(s).`);
              }),
          },
        ],
      );
    });

  const handleErase = () =>
    Alert.alert(
      'Tout effacer',
      'Toutes les journées, réglages et pesées enregistrés sur ce téléphone seront supprimés. Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () =>
            void run('erase', async () => {
              await deleteEverything();
              await reload();
              Alert.alert('Données effacées', 'L’application repart de zéro.');
            }),
        },
      ],
    );

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[typography.title, { color: theme.ink, marginBottom: spacing.md }]}>Réglages</Text>

      <SectionTitle>Programme</SectionTitle>
      <Card>
        {FIELDS.map((field, index) => (
          <View key={field.key}>
            <Row style={{ justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={[typography.body, { color: theme.ink }]}>{field.label}</Text>
                {field.hint ? <Muted>{field.hint}</Muted> : null}
              </View>
              <Stepper
                value={Number(settings[field.key])}
                step={field.step}
                min={field.min}
                max={field.max}
                suffix={field.suffix}
                width={field.suffix ? 142 : 128}
                onChange={(value) => void updateSettings({ [field.key]: value } as Partial<Settings>)}
              />
            </Row>
            {index < FIELDS.length - 1 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />
            ) : null}
          </View>
        ))}
      </Card>

      <View style={{ height: spacing.md }} />

      <Card>
        <Text style={[typography.strong, { color: theme.ink, marginBottom: spacing.xs }]}>Journée type obtenue</Text>
        <Muted>
          {preview.schedule.length} blocs de {preview.schedule[0]?.label ?? '—'} à{' '}
          {preview.schedule[preview.schedule.length - 1]?.label ?? '—'} · {formatNumber(preview.jumps)} sauts ·{' '}
          {formatDuration(preview.seconds)} · ~{formatNumber(preview.kcal)} kcal
        </Muted>
        <View style={styles.chips}>
          {preview.schedule.map((block) => (
            <View key={block.id} style={[styles.timeChip, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={[typography.tiny, { color: theme.inkSoft }]}>{block.label}</Text>
              <Text style={[typography.tiny, { color: theme.inkMuted }]}>{block.jumps}</Text>
            </View>
          ))}
        </View>
        <Divider />
        <Button
          label="Revenir au programme d’origine"
          onPress={() =>
            void updateSettings({
              jumpsPerBlock: 150,
              dailyJumpTarget: 1000,
              pushupsPerBlock: 20,
              squatsPerBlock: 20,
              startHour: 8,
              intervalHours: 2,
              blockCount: 7,
              cadence: 105,
            })
          }
        />
      </Card>

      <View style={{ height: spacing.lg }} />
      <SectionTitle>Rappels</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={[typography.body, { color: theme.ink }]}>Notification à chaque bloc</Text>
            <Muted>Un rappel local aux heures du programme. Rien n’est envoyé sur Internet.</Muted>
          </View>
          <Switch
            value={settings.remindersEnabled}
            onValueChange={(value) => void handleReminders(value)}
            trackColor={{ true: theme.brand, false: theme.surfaceSunken }}
          />
        </Row>
      </Card>

      <View style={{ height: spacing.lg }} />
      <SectionTitle>Mes données</SectionTitle>
      <Card>
        <Muted>
          Tout est stocké dans une base locale sur ce téléphone. Exporte régulièrement si tu veux une sauvegarde ou
          changer d’appareil.
        </Muted>
        <View style={{ height: spacing.md }} />
        <Button
          label="Exporter en JSON (sauvegarde)"
          busy={busy === 'json'}
          onPress={() =>
            void run('json', async () => {
              const days = await readAllDays();
              if (!days.length) throw new Error('Aucune journée à exporter pour le moment.');
              await exportJson(days, settings);
            })
          }
        />
        <View style={{ height: spacing.sm }} />
        <Button
          label="Exporter en CSV (tableur)"
          busy={busy === 'csv'}
          onPress={() =>
            void run('csv', async () => {
              const days = await readAllDays();
              if (!days.length) throw new Error('Aucune journée à exporter pour le moment.');
              await exportCsv(days, settings);
            })
          }
        />
        <View style={{ height: spacing.sm }} />
        <Button label="Importer une sauvegarde" busy={busy === 'import'} onPress={handleImport} />
        <Muted style={{ marginTop: spacing.sm }}>
          Accepte aussi le fichier exporté par la page web « Suivi sportif de Val ».
        </Muted>
        <Divider />
        <Button label="Tout effacer" variant="danger" busy={busy === 'erase'} onPress={handleErase} />
      </Card>

      <View style={{ height: spacing.lg }} />
      <Card>
        <Text style={[typography.strong, { color: theme.ink }]}>Suivi sportif · version {appVersion}</Text>
        <Muted>
          Application hors ligne : aucune donnée n’est collectée, aucun compte n’est nécessaire, aucune connexion
          n’est utilisée. Les calories affichées sont des estimations (MET) et ne remplacent pas un avis médical.
        </Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  timeChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignItems: 'center',
    minWidth: 52,
  },
});
