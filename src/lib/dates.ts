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
export const fmtKm = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
