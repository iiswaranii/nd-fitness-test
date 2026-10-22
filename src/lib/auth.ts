import { supabase } from './supabase';
import { DEMO_AUTH, DEMO_OTP, TEST_SIGNUP_CODE } from './config';
import type { Identifier } from './validation';

export type AppUser = {
  id: string;
  email: string | null;
  phone: string | null;
  provider: 'google' | 'email' | 'phone';
  name: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  password_set: boolean;
  /** Set by the member's first Strava activity link: only that athlete's activities are accepted after. */
  strava_connected: boolean;
  strava_athlete_name: string | null;
  /** Strava athlete id from the member's linked profile. Activities must be by this athlete. */
  strava_athlete_id?: string | number | null;
  role: 'member' | 'admin';
  notify_new_challenges: boolean;
};

export interface AuthApi {
  readonly demo: boolean;
  currentUser(): Promise<AppUser | null>;
  onChange(cb: (u: AppUser | null) => void): () => void;
  /** Email code. 'signup' creates the account if needed; 'reset' only works for existing accounts. */
  sendOtp(id: Identifier, mode?: 'signup' | 'reset'): Promise<void>;
  /** True when sign-up uses the fixed test code (no email is sent). */
  readonly testSignup?: boolean;
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Sets (or changes) the signed-in member's password. */
  setPassword(password: string): Promise<void>;
  verifyOtp(id: Identifier, code: string, mode?: 'signup' | 'reset'): Promise<void>;
  signOut(): Promise<void>;
  getProfile(uid: string): Promise<Profile | null>;
  updateProfile(uid: string, patch: Partial<Pick<Profile, 'full_name' | 'city' | 'state' | 'country' | 'notify_new_challenges'>>): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Supabase implementation                                             */
/* ------------------------------------------------------------------ */

function toAppUser(u: {
  id: string;
  email?: string | null;
  phone?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
} | null | undefined): AppUser | null {
  if (!u) return null;
  const prov = String(u.app_metadata?.provider ?? (u.email ? 'email' : 'phone'));
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email || null,
    phone: u.phone ? (u.phone.startsWith('+') ? u.phone : '+' + u.phone) : null,
    provider: prov === 'google' ? 'google' : prov === 'phone' ? 'phone' : 'email',
    name: (meta.full_name as string) || (meta.name as string) || null,
  };
}

function sb() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

const supabaseAuth: AuthApi = {
  demo: false,
  async currentUser() {
    const { data } = await sb().auth.getSession();
    return toAppUser(data.session?.user);
  },
  onChange(cb) {
    const { data } = sb().auth.onAuthStateChange((_e, session) => cb(toAppUser(session?.user)));
    return () => data.subscription.unsubscribe();
  },
  testSignup: !!TEST_SIGNUP_CODE,
  async sendOtp(id, mode = 'signup') {
    if (mode === 'signup' && TEST_SIGNUP_CODE && id.kind === 'email') return; // test: fixed code, no email
    const { error } =
      id.kind === 'email'
        ? await sb().auth.signInWithOtp({ email: id.email, options: { shouldCreateUser: mode === 'signup' } })
        : await sb().auth.signInWithOtp({ phone: id.phone, options: { shouldCreateUser: true, channel: 'sms' } });
    if (error) throw error;
  },
  async verifyOtp(id, code, mode = 'signup') {
    if (mode === 'signup' && TEST_SIGNUP_CODE && id.kind === 'email') {
      const { data, error } = await sb().functions.invoke('test-signup', { body: { email: id.email, code } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        const e = new Error(body?.error || error.message); e.name = error.name; throw e;
      }
      const { error: e2 } = await sb().auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
      if (e2) throw e2;
      return;
    }
    const { error } =
      id.kind === 'email'
        ? await sb().auth.verifyOtp({ email: id.email, token: code, type: 'email' })
        : await sb().auth.verifyOtp({ phone: id.phone, token: code, type: 'sms' });
    if (error) throw error;
  },
  async signInWithPassword(email, password) {
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async setPassword(password) {
    const { data, error } = await sb().auth.updateUser({ password });
    if (error) throw error;
    if (data.user) await sb().from('profiles').update({ password_set: true }).eq('id', data.user.id);
  },
  async signOut() {
    await sb().auth.signOut();
  },
  async getProfile(uid) {
    const { data, error } = await sb().from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    return (data as Profile) ?? null;
  },
  async updateProfile(uid, patch) {
    const { error } = await sb().from('profiles').update(patch).eq('id', uid);
    if (error) throw error;
  },
};

/* ------------------------------------------------------------------ */
/* Demo implementation — everything stays in this browser.            */
/* ------------------------------------------------------------------ */

type DemoAccount = { user: AppUser; password: string | null; profile: Profile };
const DK = 'ndf-auth-v2';
// Fresh start (18 Oct 2026): forget accounts from the sample-data version.
try { ['ndf-demo-auth-v1', 'ndf-demo-data-v3', 'ndf-flow'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
type DemoDB = { accounts: Record<string, DemoAccount>; session: string | null; pending: { key: string } | null };

function load(): DemoDB {
  try {
    const v = JSON.parse(localStorage.getItem(DK) || 'null');
    if (v && v.accounts) return v;
  } catch { /* storage unavailable */ }
  return { accounts: {}, session: null, pending: null };
}
function save(db: DemoDB) {
  try { localStorage.setItem(DK, JSON.stringify(db)); } catch { /* ignore */ }
}
const keyOf = (id: Identifier) => (id.kind === 'email' ? 'e:' + id.email : 'p:' + id.phone);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const listeners = new Set<(u: AppUser | null) => void>();
function emit(db: DemoDB) {
  const u = db.session ? db.accounts[db.session]?.user ?? null : null;
  listeners.forEach((cb) => cb(u));
}
/** The very first account is the owner (admin), so challenges can be created. Everyone after is a member. */
function addAccount(db: DemoDB, key: string, acc: DemoAccount) {
  if (!Object.values(db.accounts).some((a) => a.profile.role === 'admin')) acc.profile.role = 'admin';
  db.accounts[key] = acc;
}
function newAccount(id: Identifier | null, google?: boolean): DemoAccount {
  const uid = 'demo-' + Math.random().toString(36).slice(2, 10);
  const user: AppUser = {
    id: uid,
    email: google ? 'you@gmail.com' : id?.kind === 'email' ? id.email : null,
    phone: id?.kind === 'phone' ? id.phone : null,
    provider: google ? 'google' : id?.kind === 'phone' ? 'phone' : 'email',
    name: google ? 'Google User' : null,
  };
  return {
    user,
    password: null,
    profile: {
      id: uid, full_name: user.name, city: null, state: null, country: null, email: user.email, phone: user.phone,
      password_set: false, strava_connected: false, strava_athlete_name: null, role: 'member', notify_new_challenges: true,
    },
  };
}

const demoAuth: AuthApi = {
  demo: true,
  async currentUser() {
    const db = load();
    return db.session ? db.accounts[db.session]?.user ?? null : null;
  },
  onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  async sendOtp(id, mode = 'signup') {
    await wait(650);
    const db = load();
    if (mode === 'reset' && !db.accounts[keyOf(id)]) throw new Error('Signups not allowed for otp');
    db.pending = { key: keyOf(id) };
    save(db);
  },
  async verifyOtp(id, code) {
    await wait(600);
    if (code !== DEMO_OTP) throw new Error('Token has expired or is invalid');
    const db = load();
    const key = keyOf(id);
    if (!db.accounts[key]) addAccount(db, key, newAccount(id));
    db.session = key;
    db.pending = null;
    save(db);
    emit(db);
  },
  async signInWithPassword(email, password) {
    await wait(600);
    const db = load();
    const key = keyOf({ kind: 'email', email });
    const acc = db.accounts[key];
    if (!acc || !acc.password || acc.password !== password) throw new Error('Invalid login credentials');
    db.session = key;
    save(db);
    emit(db);
  },
  async setPassword(password) {
    await wait(400);
    const db = load();
    const acc = db.session ? db.accounts[db.session] : null;
    if (!acc) throw new Error('Please log in again.');
    acc.password = password;
    acc.profile.password_set = true;
    save(db);
  },
  async signOut() {
    const db = load();
    db.session = null;
    save(db);
    emit(db);
  },
  async getProfile(uid) {
    const db = load();
    return Object.values(db.accounts).find((a) => a.user.id === uid)?.profile ?? null;
  },
  async updateProfile(uid, patch) {
    await wait(300);
    const db = load();
    const acc = Object.values(db.accounts).find((a) => a.user.id === uid);
    if (acc) Object.assign(acc.profile, patch);
    save(db);
  },
};

export const auth: AuthApi = DEMO_AUTH ? demoAuth : supabaseAuth;

/** Demo only: the first Strava link ties the demo member to an athlete name. */
export function demoLinkStrava(athleteName: string): void {
  const db = load();
  const acc = db.session ? db.accounts[db.session] : null;
  if (!acc) return;
  acc.profile.strava_connected = true;
  acc.profile.strava_athlete_name = athleteName;
  save(db);
}

/** Test mode: link a Strava profile by its link (the id is read from the URL; short links get a stand-in id). */
export function demoLinkStravaProfile(url: string): { athleteId: string; athleteName: string } {
  const db = load();
  const acc = db.session ? db.accounts[db.session] : null;
  const id = url.match(/athletes\/(\d+)/)?.[1] ?? String(100000 + Math.floor(Math.random() * 900000));
  const name = acc?.profile.full_name || 'Strava athlete';
  if (acc) { acc.profile.strava_connected = true; acc.profile.strava_athlete_name = name; acc.profile.strava_athlete_id = id; save(db); }
  return { athleteId: id, athleteName: name };
}

/** Test mode: every account on this phone, for the admin's member list. */
export function demoAllProfiles(): Profile[] {
  return Object.values(load().accounts).map((a) => a.profile);
}

/** Test mode: erase every account and sign out. */
export function demoEraseAccounts(): void {
  try { localStorage.removeItem(DK); } catch { /* ignore */ }
}
