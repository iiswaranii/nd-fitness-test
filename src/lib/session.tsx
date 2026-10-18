import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, type AppUser, type Profile } from './auth';

type SessionValue = {
  ready: boolean;
  user: AppUser | null;
  profile: Profile | null;
  /** Signed in with email/phone OTP but hasn't chosen a password yet. */
  /** Signed in but hasn't given name and location yet: goes to profile setup. */
  needsProfile: boolean;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (u: AppUser | null) => {
    if (!u) { setProfile(null); return; }
    try {
      // The profile row is created by a database trigger; on first sign-in it can lag a moment.
      let p = await auth.getProfile(u.id);
      for (let i = 0; !p && i < 3; i++) { await new Promise((r) => setTimeout(r, 400)); p = await auth.getProfile(u.id); }
      setProfile(p);
    } catch { setProfile(null); }
  }, []);

  useEffect(() => {
    let alive = true;
    auth.currentUser().then(async (u) => {
      if (!alive) return;
      setUser(u);
      await loadProfile(u);
      if (alive) setReady(true);
    });
    const off = auth.onChange((u) => {
      setUser((prev) => (prev?.id === u?.id && prev?.name === u?.name ? prev : u));
      loadProfile(u);
    });
    return () => { alive = false; off(); };
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(user), [loadProfile, user]);

  // Coming back to the app (e.g. after approving Strava in the browser) picks up profile changes.
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible' && user) loadProfile(user); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [user, loadProfile]);

  const value = useMemo<SessionValue>(() => ({
    ready, user, profile, refreshProfile,
    needsProfile: !!user && !!profile && (!profile.full_name?.trim() || !profile.country || !profile.state),
  }), [ready, user, profile, refreshProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be inside SessionProvider');
  return v;
}
