const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDay = (s: string) => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export function fmtRange(a: string, b: string) {
  const x = parse(a), y = parse(b);
  return x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()
    ? `${x.getDate()}–${y.getDate()} ${MON[y.getMonth()]}`
    : `${fmtDay(a)} – ${fmtDay(b)}`;
}
export function relDay(s: string) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  return parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
/** An exact moment (UTC ISO) in this phone's local time: "25 Oct, 11:59 pm". */
export const fmtMoment = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  return `${d.getDate()} ${MON[d.getMonth()]}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
/** Last moment to join, in local time; falls back to the date on old rows. */
export const joinByText = (c: { join_by: string; join_by_at?: string | null }) => (c.join_by_at ? fmtMoment(c.join_by_at) : fmtDay(c.join_by));
export const regOpensText = (c: { reg_opens: string; reg_opens_at?: string | null }) => (c.reg_opens_at ? fmtMoment(c.reg_opens_at) : fmtDay(c.reg_opens));
/** Start of a local calendar day / end of it, as UTC ISO (the admin's phone time zone). */
export const localDayStartIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0).toISOString(); };
export const localDayEndIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59).toISOString(); };
/** "14:00" → "2:00 pm" */
export const clock12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
/** "25 Oct, 12:00 pm – 30 Oct" — times only when the challenge doesn't use whole days. */
export const fmtWindow = (c: { start_date: string; end_date: string; start_time?: string | null; end_time?: string | null }) => {
  const st = (c.start_time ?? '00:00').slice(0, 5), et = (c.end_time ?? '23:59').slice(0, 5);
  if (st === '00:00' && et === '23:59') return fmtRange(c.start_date, c.end_date);
  return `${fmtDay(c.start_date)}${st !== '00:00' ? `, ${clock12(st)}` : ''} – ${fmtDay(c.end_date)}${et !== '23:59' ? `, ${clock12(et)}` : ''}`;
};
export const longDay = (s: string) => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export function ago(iso: string | null) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
/** 42m 34s · 1h 05m 20s */
export const fmtHms = (s: number) => { const t = Math.round(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return h ? `${h}h ${pad(m)}m ${pad(x)}s` : `${m}m ${pad(x)}s`; };
export const fmtDur = (s: number) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h ${pad(m)}m` : `${m} min`; };
/** Two decimals, like Strava (2.33). Totals keep every decimal; this is display only. */
export const fmtKm = (v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
/** Distance exactly as stored, trailing zeros trimmed (1.20082). */
export const fmtKmExact = (v: number) => String(+v.toFixed(5));
