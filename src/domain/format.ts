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
