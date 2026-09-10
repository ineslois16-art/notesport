/**
 * Partage des sauvegardes : écriture d'un fichier temporaire puis feuille de
 * partage du système. La lecture/écriture du format vit dans `backupFormat.ts`
 * (pur, testable) — ici on ne fait que les entrées-sorties.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { DayRecord, Settings } from '../domain/program';
import { buildCsv, buildPayload } from './backupFormat';

export { buildPayload, parseBackup, type ParsedBackup } from './backupFormat';

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return new File(result.assets[0].uri).text();
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function shareText(fileName: string, contents: string, mimeType: string, uti: string): Promise<string> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Sauvegarde du suivi sportif', UTI: uti });
  }
  return file.uri;
}

export async function exportJson(days: DayRecord[], settings: Settings): Promise<string> {
  const payload = buildPayload(days, settings);
  return shareText(
    `suivi-sportif-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
    'public.json',
  );
}

export async function exportCsv(days: DayRecord[], settings: Settings): Promise<string> {
  return shareText(`suivi-sportif-${stamp()}.csv`, buildCsv(days, settings), 'text/csv', 'public.comma-separated-values-text');
}
