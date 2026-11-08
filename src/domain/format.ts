const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Aujourd’hui" or "15 oct." */
export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isSameDay(d, now)) return 'Aujourd’hui';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isSameDay(d, y)) return 'Hier';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Aujourd’hui 10:12" */
export function formatDayTime(iso: string, now = new Date()): string {
  return `${formatDay(iso, now)} ${formatTime(iso)}`;
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

/** "81 234 5678" → "+243 81 234 5678" */
export function formatMsisdn(local: string) {
  return `+243 ${local.trim()}`;
}

/** Short age, as on SC4: « 5 min », « 2 h », « 3 j ». */
export function formatAgo(iso: string, now = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}
