import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { data } from './data';
import { refreshPushSubscription } from './push';
import { useSession } from './session';
import { friendlyError } from './errors';
import type { Activity, Challenge, HabitLog } from './types';

type Store = {
  loading: boolean;
  error: string | null;
  challenges: Challenge[];
  activities: Activity[];
  logs: HabitLog[];
  reload: () => Promise<void>;
  saveLog: (challengeId: string, date: string, value: number | null, entries: number[]) => Promise<void>;
  isAdmin: boolean;
  /** Challenges published recently that this member hasn't opened yet. */
  newIds: Set<string>;
  markSeen: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);
const NEW_FOR_DAYS = 14;
const seenKey = (uid: string) => `ndf-seen-${uid}`;
function readSeen(uid: string): string[] {
  try { return JSON.parse(localStorage.getItem(seenKey(uid)) || '[]'); } catch { return []; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [seen, setSeen] = useState<string[]>(() => (user ? readSeen(user.id) : []));
  useEffect(() => { if (user) setSeen(readSeen(user.id)); }, [user]);
  const markSeen = useCallback((id: string) => {
    if (!user) return;
    setSeen((s) => {
      if (s.includes(id)) return s;
      const next = [...s, id];
      try { localStorage.setItem(seenKey(user.id), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [user]);
  const newIds = useMemo(() => {
    const cutoff = Date.now() - NEW_FOR_DAYS * 864e5;
    const t = new Date(); const td = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return new Set(challenges.filter((c) => !c.joined && !c.cancelled && c.end_date >= td && new Date(c.created_at).getTime() > cutoff && !seen.includes(c.id)).map((c) => c.id));
  }, [challenges, seen]);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [c, a, l] = await Promise.all([data.listChallenges(), data.myActivities(), data.myLogs()]);
      setChallenges(c); setActivities(a); setLogs(l); setError(null);
    } catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);
  // Browsers rotate push subscriptions; re-save this phone's on each open.
  useEffect(() => { if (user) refreshPushSubscription(); }, [user]);

  // Coming back to the app refreshes challenges and activities (e.g. after adding a link on another phone).
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  const saveLog = useCallback(async (cid: string, date: string, value: number | null, entries: number[]) => {
    const prev = logs;
    // Optimistic: update immediately, roll back on failure.
    setLogs((ls) => {
      const rest = ls.filter((l) => !(l.challenge_id === cid && l.date === date));
      return value === null ? rest : [...rest, { challenge_id: cid, date, value, entries }];
    });
    try { await data.saveLog(cid, date, value, entries); }
    catch (e) { setLogs(prev); throw e; }
  }, [logs]);

  const value = useMemo<Store>(() => ({
    loading, error, challenges, activities, logs, reload, saveLog,
    isAdmin: profile?.role === 'admin', newIds, markSeen,
  }), [loading, error, challenges, activities, logs, reload, saveLog, profile?.role, newIds, markSeen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be inside StoreProvider');
  return v;
}
