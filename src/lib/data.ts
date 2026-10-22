import { supabase } from './supabase';
import { DEMO_AUTH } from './config';
import { auth, demoAllProfiles, demoLinkStrava } from './auth';
import { today } from './dates';
import { ageBand, ageOn, matches } from './audience';
import { SPORTS, type Activity, type Challenge, type HabitLog, type Health, type MemberStat, type NewChallenge, type Participant, type Sport } from './types';

export interface DataApi {
  listChallenges(): Promise<Challenge[]>;
  createChallenge(c: NewChallenge): Promise<string>;
  cancelChallenge(id: string): Promise<void>;
  join(id: string, myDailyTarget: number | null, reminder?: string | null): Promise<void>;
  setReminder(id: string, time: string | null): Promise<void>;
  /** Phone notifications: store or remove this device's push subscription. */
  savePushSubscription(sub: PushSubscriptionJSON, tz: string): Promise<void>;
  /** The app's public Web Push key (created by the server on first use). */
  pushPublicKey(): Promise<string>;
  removePushSubscription(endpoint: string): Promise<void>;
  /** Admin: tell members about a newly published challenge. */
  announceChallenge(id: string): Promise<{ sent: number }>;
  leave(id: string): Promise<void>;
  setMyDailyTarget(id: string, v: number | null): Promise<void>;
  myActivities(): Promise<Activity[]>;
  myLogs(): Promise<HabitLog[]>;
  saveLog(challengeId: string, date: string, value: number | null, entries: number[]): Promise<void>;
  /**
   * Reads a Strava activity from a pasted link and saves it. When Strava doesn't show the numbers publicly,
   * returns { needsStats } with what it could read; call again with `manual` (distance and time from Strava).
   */
  /** confirm=true saves Strava's own numbers (the server reads them again; the app sends none). */
  addActivityByLink(text: string, manual?: ManualStats, confirm?: boolean): Promise<LinkResult>;
  removeActivity(id: string): Promise<void>;
  participants(challengeId: string): Promise<Participant[]>;
  /** Members of a challenge with the data needed to rank them. Members of the challenge and admins only. */
  board(challengeId: string): Promise<Participant[]>;
  /** Admin: one row per member for the insights page. */
  memberStats(): Promise<MemberStat[]>;
  /** Test environment only: latest login codes (admins). */
  testInbox(): Promise<{ email: string; kind: string | null; code: string | null; created_at: string }[]>;
  /** Private body measurements — only ever read by the member themselves. */
  getHealth(): Promise<Health | null>;
  saveHealth(h: { dob?: string | null; mobile?: string | null; height_cm: number | null; weight_kg: number | null }): Promise<void>;
}

/**
 * Finds a Strava activity in what the member pasted: a strava.com/activities/… link, a strava.app.link
 * share link (resolved on the server), or the Share → Embed code (which also carries a token for
 * followers-only activities).
 */
export function parseStravaLink(text: string): { id?: string; shortUrl?: string; token?: string } | null {
  const e = text.match(/data-embed-id=["']?(\d{6,})/i);
  if (e) return { id: e[1], token: text.match(/data-token=["']?([\w-]+)/i)?.[1] };
  const m = text.match(/strava\.com\/activities\/(\d{6,})/i) ?? text.match(/strava-embeds\.com\/activity\/(\d{6,})/i);
  if (m) return { id: m[1], token: text.match(/[?&]token=([\w-]+)/i)?.[1] };
  const s = text.match(/https?:\/\/(?:strava\.app\.link|stra\.va)\/[\w-]+/i);
  if (s) return { shortUrl: s[0] };
  if (/^\s*\d{8,}\s*$/.test(text)) return { id: text.trim() };
  return null;
}

export type ManualStats = { km: number; seconds: number; sport?: Sport; date?: string; edited?: boolean };
export type LinkPreview = {
  id: string | null; title: string | null; sportType: string | null; sport: Sport | null; date: string | null; athleteName: string | null;
  time?: string | null;
  /** Suggested from the public GPS route; the member reviews before saving. */
  km?: number | null; seconds?: number | null; measured?: boolean;
  /** Numbers are Strava's own summary (not measured from the route). */
  official?: boolean;
  /** Part of the route is hidden by a Strava privacy zone, so the distance is likely too short. */
  partial?: boolean;
};
export type LinkResult =
  | { needsStats?: false; activity: Activity; athleteName: string; firstLink: boolean }
  | { needsStats: true; preview: LinkPreview };

/* ================================================================== */
/* Supabase                                                            */
/* ================================================================== */

function sb() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}
async function uid(): Promise<string> {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error('Please log in again.');
  return data.user.id;
}
type ActRow = { id: number | string; sport: Sport; name: string; local_date: string; local_time: string; distance_m: number; moving_s: number; elapsed_s: number; elev_m: number | null; source: 'sync' | 'link' | 'manual' };
const toAct = (r: ActRow): Activity => ({
  id: String(r.id), sport: r.sport, name: r.name, date: r.local_date, time: String(r.local_time).slice(0, 5),
  km: Number(r.distance_m) / 1000, moving_s: r.moving_s, elapsed_s: r.elapsed_s, elev_m: r.elev_m, source: r.source,
});
async function fnError(error: unknown): Promise<Error> {
  const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
  return new Error(body?.error || (error as Error).message);
}

const supabaseData: DataApi = {
  async listChallenges() {
    const me = await uid();
    const [{ data: cs, error }, { data: counts }, { data: mine }] = await Promise.all([
      sb().from('challenges').select('*, eligible:member_can_see').order('start_date', { ascending: false }),
      sb().rpc('challenge_member_counts'),
      sb().from('challenge_members').select('challenge_id, daily_target, reminder_time').eq('user_id', me),
    ]);
    if (error) throw error;
    const cnt = new Map((counts ?? []).map((r: { challenge_id: string; members: number }) => [r.challenge_id, r.members]));
    const my = new Map((mine ?? []).map((r: { challenge_id: string; daily_target: number | null; reminder_time: string | null }) => [r.challenge_id, r]));
    return (cs ?? []).map((c) => ({
      ...c,
      target: Number(c.target), daily_min: c.daily_min === null ? null : Number(c.daily_min), min_km: c.min_km === null ? null : Number(c.min_km),
      daily_target: c.daily_target === null ? null : Number(c.daily_target),
      eligible: c.eligible !== false,
      member_count: Number(cnt.get(c.id) ?? 0), joined: my.has(c.id), my_daily_target: my.get(c.id)?.daily_target ?? null, my_reminder: my.get(c.id)?.reminder_time?.slice(0, 5) ?? null,
    })) as Challenge[];
  },
  async createChallenge(c) {
    const { data: row, error } = await sb().from('challenges').insert({ ...c, created_by: await uid() }).select('id').single();
    if (error) throw error;
    return row.id as string;
  },
  async cancelChallenge(id) {
    const { error } = await sb().from('challenges').update({ cancelled: true }).eq('id', id);
    if (error) throw error;
  },
  async join(id, t, reminder = null) {
    const { error } = await sb().from('challenge_members').insert({ challenge_id: id, user_id: await uid(), daily_target: t, reminder_time: reminder });
    if (error) throw error;
  },
  async setReminder(id, time) {
    const { error } = await sb().from('challenge_members').update({ reminder_time: time }).eq('challenge_id', id).eq('user_id', await uid());
    if (error) throw error;
  },
  async savePushSubscription(sub, tz) {
    const { error } = await sb().from('push_subscriptions').upsert({
      user_id: await uid(), endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth, tz,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  },
  async pushPublicKey() {
    const { data, error } = await sb().functions.invoke('notify-new-challenge', { body: { action: 'keys' } });
    if (error) throw await fnError(error);
    return String(data?.publicKey ?? '');
  },
  async removePushSubscription(endpoint) {
    await sb().from('push_subscriptions').delete().eq('endpoint', endpoint);
  },
  async announceChallenge(id) {
    const { data, error } = await sb().functions.invoke('notify-new-challenge', { body: { challenge_id: id } });
    if (error) throw await fnError(error);
    return { sent: Number(data?.sent ?? 0) };
  },
  async leave(id) {
    const { error } = await sb().from('challenge_members').delete().eq('challenge_id', id).eq('user_id', await uid());
    if (error) throw error;
  },
  async setMyDailyTarget(id, v) {
    const { error } = await sb().from('challenge_members').update({ daily_target: v }).eq('challenge_id', id).eq('user_id', await uid());
    if (error) throw error;
  },
  async myActivities() {
    const { data, error } = await sb().from('activities').select('*').eq('user_id', await uid()).order('start_utc', { ascending: false }).limit(500);
    if (error) throw error;
    return (data as ActRow[]).map(toAct);
  },
  async myLogs() {
    const { data, error } = await sb().from('habit_logs').select('challenge_id, day, value, entries').eq('user_id', await uid());
    if (error) throw error;
    return (data ?? []).map((r) => ({ challenge_id: r.challenge_id, date: r.day, value: Number(r.value), entries: (r.entries ?? []).map(Number) }));
  },
  async saveLog(challengeId, date, value, entries) {
    const me = await uid();
    if (value === null) {
      const { error } = await sb().from('habit_logs').delete().eq('user_id', me).eq('challenge_id', challengeId).eq('day', date);
      if (error) throw error;
      return;
    }
    const { error } = await sb().from('habit_logs').upsert({ user_id: me, challenge_id: challengeId, day: date, value, entries });
    if (error) throw error;
  },
  async addActivityByLink(text, manual, confirm) {
    const p = parseStravaLink(text);
    if (!p) throw new Error('That doesn’t look like a Strava activity link.');
    const { data, error } = await sb().functions.invoke('strava-activity', { body: { ...p, today: today(), manual, confirm: confirm === true } });
    if (error) throw await fnError(error);
    if (data.needsStats) return { needsStats: true, preview: data.preview as LinkPreview };
    return { activity: toAct(data.activity as ActRow), athleteName: String(data.athleteName ?? ''), firstLink: !!data.firstLink };
  },
  async removeActivity(id) {
    const { error } = await sb().from('activities').delete().eq('id', id).eq('user_id', await uid());
    if (error) throw error;
  },
  async participants(challengeId) {
    const { data: members, error } = await sb()
      .from('challenge_members')
      .select('user_id, joined_at, profiles(full_name, city, country, strava_connected)')
      .eq('challenge_id', challengeId);
    if (error) throw error;
    const ids = (members ?? []).map((m) => m.user_id);
    if (!ids.length) return [];
    const [{ data: acts }, { data: logs }] = await Promise.all([
      sb().from('activities').select('*').in('user_id', ids),
      sb().from('habit_logs').select('user_id, challenge_id, day, value, entries').eq('challenge_id', challengeId),
    ]);
    return (members ?? []).map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { full_name: string | null; city: string | null; country: string | null; strava_connected: boolean } | null;
      return {
        user_id: m.user_id,
        name: p?.full_name || 'Member',
        city: p?.city ?? null,
        country: p?.country ?? null,
        strava_connected: !!p?.strava_connected,
        joined_at: m.joined_at,
        activities: ((acts ?? []) as (ActRow & { user_id: string })[]).filter((a) => a.user_id === m.user_id).map(toAct),
        logs: (logs ?? []).filter((l) => l.user_id === m.user_id).map((l) => ({ challenge_id: l.challenge_id, date: l.day, value: Number(l.value), entries: (l.entries ?? []).map(Number) })),
      };
    });
  },
  async board(challengeId) {
    const { data, error } = await sb().rpc('challenge_board', { cid: challengeId });
    if (error) throw error;
    return (data ?? []).map((r: { user_id: string; name: string; city: string | null; country: string | null; activities: Activity[]; logs: HabitLog[] }) => ({
      user_id: r.user_id, name: r.name, city: r.city, country: r.country ?? null, strava_connected: true, joined_at: '',
      activities: (r.activities ?? []).map((a) => ({ ...a, km: Number(a.km) })),
      logs: (r.logs ?? []).map((l) => ({ ...l, value: Number(l.value) })),
    }));
  },
  async testInbox() {
    const { data, error } = await sb().rpc('admin_test_inbox');
    if (error) throw error;
    return data ?? [];
  },
  async memberStats() {
    const { data, error } = await sb().rpc('admin_member_stats');
    if (error) throw error;
    return (data ?? []) as MemberStat[];
  },
  async getHealth() {
    const { data, error } = await sb().from('profile_health').select('dob, mobile, height_cm, weight_kg, updated_at').eq('user_id', await uid()).maybeSingle();
    if (error) throw error;
    return data ? { dob: data.dob ?? null, mobile: data.mobile ?? null, height_cm: data.height_cm === null ? null : Number(data.height_cm), weight_kg: data.weight_kg === null ? null : Number(data.weight_kg), updated_at: data.updated_at } : null;
  },
  async saveHealth(h) {
    const { error } = await sb().from('profile_health').upsert({ user_id: await uid(), ...h });
    if (error) throw error;
  },
};

/* ================================================================== */
/* Demo — everything lives in this browser.                            */
/* ================================================================== */

const DK = 'ndf-data-v4';
type DemoMember = { user_id: string; name: string; city: string; daily_target: number | null; joined_at: string; reminder?: string | null };
type DemoState = {
  challenges: (Omit<Challenge, 'member_count' | 'joined' | 'my_daily_target' | 'my_reminder' | 'eligible'>)[];
  members: Record<string, DemoMember[]>;
  activities: Record<string, Activity[]>;
  logs: Record<string, HabitLog[]>;
  health?: Record<string, Health>;
};


/** A fresh app: no challenges, members or activities until people create them. */
function seed(): DemoState {
  return { challenges: [], members: {}, activities: {}, logs: {} };
}

function load(): DemoState {
  try { const v = JSON.parse(localStorage.getItem(DK) || 'null'); if (v?.challenges) return v; } catch { /* ignore */ }
  const s = seed(); save(s); return s;
}
function save(s: DemoState) { try { localStorage.setItem(DK, JSON.stringify(s)); } catch { /* ignore */ } }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function me() {
  const u = await auth.currentUser();
  if (!u) throw new Error('Please log in again.');
  const p = await auth.getProfile(u.id);
  return { id: u.id, name: p?.full_name || u.name || 'You', city: p?.city ?? '', state: p?.state ?? null, country: p?.country ?? null, strava: !!p?.strava_connected, admin: p?.role === 'admin' };
}

const demoData: DataApi = {
  async listChallenges() {
    const s = load(), m = await me();
    const who = { dob: s.health?.[m.id]?.dob ?? null, country: m.country, state: m.state };
    // Everyone sees every challenge; only members in the audience can join.
    return s.challenges
      .map((c) => {
      const ms = s.members[c.id] ?? [];
      const mine = ms.find((x) => x.user_id === m.id);
      return { ...c, eligible: matches(c as Challenge, who), member_count: ms.length, joined: !!mine, my_daily_target: mine?.daily_target ?? null, my_reminder: mine?.reminder ?? null };
    }).sort((a, b) => b.start_date.localeCompare(a.start_date));
  },
  async createChallenge(c) {
    await wait(400);
    const s = load();
    const id = 'c-' + Math.random().toString(36).slice(2, 9);
    s.challenges.push({ ...c, id, cancelled: false, created_at: new Date().toISOString() });
    s.members[id] = [];
    save(s);
    return id;
  },
  async cancelChallenge(id) {
    const s = load(); const c = s.challenges.find((x) => x.id === id); if (c) c.cancelled = true; save(s);
  },
  async join(id, t, reminder = null) {
    await wait(300);
    const s = load(), m = await me();
    (s.members[id] ??= []).push({ user_id: m.id, name: m.name, city: m.city, daily_target: t, joined_at: today(), reminder });
    save(s);
  },
  async setReminder(id, time) {
    const s = load(), m = await me();
    const x = (s.members[id] ?? []).find((y) => y.user_id === m.id);
    if (x) x.reminder = time;
    save(s);
  },
  async savePushSubscription() { /* demo: nothing to store */ },
  async pushPublicKey() { return ''; },
  async removePushSubscription() { /* demo */ },
  async announceChallenge() { await wait(300); return { sent: 0 }; },
  async leave(id) {
    const s = load(), m = await me();
    s.members[id] = (s.members[id] ?? []).filter((x) => x.user_id !== m.id);
    save(s);
  },
  async setMyDailyTarget(id, v) {
    const s = load(), m = await me();
    const x = (s.members[id] ?? []).find((y) => y.user_id === m.id);
    if (x) x.daily_target = v;
    save(s);
  },
  async myActivities() {
    const s = load(), m = await me();
    return [...(s.activities[m.id] ?? [])].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  },
  async myLogs() {
    const s = load(), m = await me();
    return s.logs[m.id] ?? [];
  },
  async saveLog(cid, date, value, entries) {
    const s = load(), m = await me();
    const list = (s.logs[m.id] ??= []).filter((l) => !(l.challenge_id === cid && l.date === date));
    if (value !== null) list.push({ challenge_id: cid, date, value, entries });
    s.logs[m.id] = list;
    save(s);
  },
  async addActivityByLink(text, manual) {
    // Test mode has no server, so it can't open Strava links: the member types what Strava shows.
    const p = parseStravaLink(text);
    if (!p) throw new Error('That doesn’t look like a Strava activity link.');
    await wait(500);
    const s = load(), m = await me();
    const short = text.match(/https?:\/\/(?:strava\.app\.link|stra\.va)\/[\w-]+/i)?.[0];
    const id = p.id ?? 'link-' + (p.shortUrl ?? '').split('/').pop();
    const url = p.id ? `https://www.strava.com/activities/${p.id}` : short;
    const list = (s.activities[m.id] ??= []);
    if (list.some((a) => a.id === id)) throw new Error('You’ve already added this activity.');
    if (!manual) return { needsStats: true, preview: { id: p.id ?? null, title: null, sportType: null, sport: null, date: null, athleteName: null } };
    const sport = manual.sport ?? 'walk';
    const a: Activity = {
      id, url, sport, name: `${SPORTS[sport].verb}`, date: manual.date ?? today(), time: '00:00',
      km: +manual.km.toFixed(2), moving_s: Math.round(manual.seconds), elapsed_s: Math.round(manual.seconds), elev_m: null, source: 'manual',
    };
    list.push(a);
    save(s);
    const firstLink = !m.strava;
    if (firstLink) demoLinkStrava(m.name);
    return { activity: a, athleteName: m.name, firstLink };
  },
  async removeActivity(id) {
    const s = load(), m = await me();
    s.activities[m.id] = (s.activities[m.id] ?? []).filter((a) => a.id !== id);
    save(s);
  },
  async participants(cid) {
    await wait(250);
    const s = load(), m = await me();
    return (s.members[cid] ?? []).map((x) => ({
      user_id: x.user_id, name: x.user_id === m.id ? m.name : x.name, city: x.user_id === m.id ? m.city : x.city, country: x.user_id === m.id ? m.country : (x as { country?: string }).country ?? 'India',
      strava_connected: x.user_id === m.id ? m.strava : true, joined_at: x.joined_at,
      activities: s.activities[x.user_id] ?? [],
      logs: (s.logs[x.user_id] ?? []).filter((l) => l.challenge_id === cid),
    }));
  },
  async board(cid) {
    const s = load(), m = await me();
    const mine = (s.members[cid] ?? []).some((x) => x.user_id === m.id);
    const c = s.challenges.find((x) => x.id === cid);
    if (!mine && !(await isDemoAdmin()) && !(c && c.start_date <= today())) throw new Error('This leaderboard opens when the challenge starts');
    return this.participants(cid);
  },
  async testInbox() { return []; },
  async memberStats() {
    await wait(300);
    return roster(load());
  },
  async getHealth() {
    const s = load(), m = await me();
    return s.health?.[m.id] ?? null;
  },
  async saveHealth(h) {
    await wait(250);
    const s = load(), m = await me();
    const prev = s.health?.[m.id];
    (s.health ??= {})[m.id] = { dob: h.dob !== undefined ? h.dob : prev?.dob ?? null, mobile: h.mobile !== undefined ? h.mobile : prev?.mobile ?? null, height_cm: h.height_cm, weight_kg: h.weight_kg, updated_at: new Date().toISOString() };
    save(s);
  },
};

async function isDemoAdmin() {
  const u = await auth.currentUser();
  return (u ? await auth.getProfile(u.id) : null)?.role === 'admin';
}

/** Admin member list in test mode: every account created on this phone. */
function roster(s: DemoState): MemberStat[] {
  const t = today();
  const liveIds = new Set(s.challenges.filter((c) => !c.cancelled && c.end_date >= t).map((c) => c.id));
  return demoAllProfiles().map((p) => {
    const ids = Object.keys(s.members).filter((cid) => s.members[cid].some((x) => x.user_id === p.id));
    const ds = [...(s.activities[p.id] ?? []).map((a) => a.date), ...(s.logs[p.id] ?? []).map((l) => l.date)].sort();
    return {
      user_id: p.id, name: p.full_name || 'Member', city: p.city, state: p.state, country: p.country,
      joined_at: (p as { created_at?: string }).created_at ?? t, age_band: ageBand(ageOn(s.health?.[p.id]?.dob)),
      strava_connected: p.strava_connected, challenges: ids.length, live_challenges: ids.filter((id) => liveIds.has(id)).length,
      last_active: ds.length ? ds[ds.length - 1] : null,
    };
  });
}

/** Test mode: erase all challenges, activities and logs on this phone. */
export function resetDemoData() {
  try { localStorage.removeItem(DK); } catch { /* ignore */ }
}

export const data: DataApi = DEMO_AUTH ? demoData : supabaseData;
