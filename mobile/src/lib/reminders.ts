/**
 * Rappels locaux : une notification par bloc, tous les jours à l'heure prévue.
 * Rien ne sort du téléphone — ce sont des notifications planifiées localement,
 * pas des push serveur.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { buildSchedule, type Settings } from '../domain/program';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('blocs', {
    name: 'Rappels de blocs',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

/**
 * Reprogramme l'intégralité des rappels à partir des réglages courants.
 * Silencieux en cas d'échec : un rappel manquant ne doit jamais empêcher
 * l'enregistrement d'une séance.
 */
export async function syncReminders(settings: Settings): Promise<boolean> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.remindersEnabled) return true;

    const granted = await ensurePermission();
    if (!granted) return false;
    await ensureAndroidChannel();

    for (const block of buildSchedule(settings)) {
      const parts = [
        block.jumps > 0 ? `${block.jumps} sauts` : null,
        block.pushups > 0 ? `${block.pushups} pompes` : null,
        block.squats > 0 ? `${block.squats} squats` : null,
      ].filter(Boolean);
      if (!parts.length) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `bloc-${block.id}`,
        content: {
          title: `Bloc de ${block.label}`,
          body: parts.join(' · '),
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: block.hour,
          minute: block.minute,
          channelId: 'blocs',
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function cancelReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // rien à faire : les rappels sont un confort, pas une donnée.
  }
}
