/**
 * Toutes les dates de l'application sont des chaînes `YYYY-MM-DD` en heure
 * locale. On n'utilise jamais `toISOString()` : il bascule en UTC et décale la
 * journée d'un cran pour une partie du monde.
 */

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, amount: number): ISODate {
  const date = fromISO(iso);
  date.setDate(date.getDate() + amount);
  return toISO(date);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = fromISO(to).getTime() - fromISO(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Liste continue de dates, bornes incluses. */
export function rangeISO(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
}

export function isToday(iso: ISODate): boolean {
  return iso === todayISO();
}

export function isFuture(iso: ISODate): boolean {
  return iso > todayISO();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatDayTitle(iso: ISODate): string {
  if (isToday(iso)) return "Aujourd'hui";
  if (iso === addDays(todayISO(), -1)) return 'Hier';
  if (iso === addDays(todayISO(), 1)) return 'Demain';
  return capitalize(fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function formatShort(iso: ISODate): string {
  return fromISO(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function formatDayMonth(iso: ISODate): string {
  return fromISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatMonthTitle(iso: ISODate): string {
  return capitalize(fromISO(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
}

export function weekdayLetter(iso: ISODate): string {
  return capitalize(fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3));
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}
