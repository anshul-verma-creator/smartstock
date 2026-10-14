/** Business-local dates are plain 'YYYY-MM-DD' strings in Asia/Kolkata. */
export const TZ = 'Asia/Kolkata';

export function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

const dShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dLong = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const mLong = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const wd = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
const tm = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

export const fmtDay = (iso: string) => dShort.format(new Date(`${iso}T00:00:00Z`));
export const fmtDate = (iso: string) => dLong.format(new Date(`${iso}T00:00:00Z`));
export const fmtMonth = (ym: string) => mLong.format(new Date(`${ym}-01T00:00:00Z`));
export const fmtWeekday = (iso: string) => wd.format(new Date(`${iso}T00:00:00Z`));
export const fmtTime = (ts: string) => tm.format(new Date(ts));

export function relDays(days: number): string {
  if (days < -1) return `expired ${-days} days ago`;
  if (days === -1) return 'expired yesterday';
  if (days === 0) return 'expires today';
  if (days === 1) return 'expires tomorrow';
  return `${days} days left`;
}
