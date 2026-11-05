import { createContext, useContext, useEffect, useState } from 'react';
import type { Challenge } from './types';
import { status } from './progress';

/**
 * Dual pane for unfolded foldables and tablets. One tab bar for the whole screen. The left pane shows the
 * tab you picked; the right pane shows what goes with it (never the same tab twice):
 *   Today → Activity · Challenges → the challenge you tapped (first joined one to start) · Activity → Stats
 *   Profile → Trophies & badges · Admin → Member insights (or the challenge you tapped)
 * Anything you open from the left (a challenge, stats, trophies, an admin challenge…) opens on the right,
 * so the list stays in view. Back on the right returns to the companion page.
 */
export type Pane = 'single' | 'left' | 'right';
export const PaneContext = createContext<Pane>('single');
export const usePane = () => useContext(PaneContext);
/** In the right pane: the page it starts on (its back button is hidden there; there's nothing to go back to). */
export const PaneRootContext = createContext<string | null>(null);
/** What the right pane is showing (so the left list can mark the selected item). */
export const PaneOpenContext = createContext<string | null>(null);
export const useOpenInPane = () => useContext(PaneOpenContext);

// Wide enough for two phone-width panes, and tall enough that it isn't just a phone turned sideways.
const QUERY = '(min-width: 700px) and (min-height: 560px), (horizontal-viewport-segments: 2)';

export function useDuo(): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const f = () => setOn(mq.matches);
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  return on;
}

export const TABS = ['/', '/challenges', '/activity', '/admin', '/profile'] as const;
const SETUP = ['/about', '/set-password'];

/** The tab a path belongs to (what the left pane shows and the tab bar highlights). */
export function tabOf(path: string): string {
  if (path === '/' || SETUP.includes(path)) return path;
  if (path.startsWith('/challenges') || path.startsWith('/c/')) return '/challenges';
  if (path.startsWith('/activity')) return '/activity';
  if (path.startsWith('/admin')) return '/admin';
  return '/profile'; // stats, trophies, badges, guide, awards
}

/** A page that belongs on the right: everything that isn't a tab root or a setup step. */
export const isDetail = (path: string) => !(TABS as readonly string[]).includes(path) && !SETUP.includes(path);

/** What the right pane shows next to a tab. */
export function companionOf(tab: string, challenges: Challenge[]): string {
  switch (tab) {
    case '/': return '/activity';
    case '/challenges': {
      const live = (c: Challenge) => status(c) === 'active' || status(c) === 'upcoming';
      const pick = challenges.find((c) => c.joined && status(c) === 'active') ?? challenges.find((c) => c.joined && live(c)) ?? challenges.find(live) ?? challenges.find((c) => status(c) === 'finished');
      return pick ? `/c/${pick.id}` : '/activity';
    }
    case '/activity': return '/stats';
    case '/admin': return '/admin/insights';
    case '/profile': return '/awards';
    default: return '/profile';
  }
}

const KEY = 'ndf-pane2';
export const readDetail = (tab: string): string | null => {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return v && v.tab === tab ? v.detail : null; } catch { return null; }
};
export const saveDetail = (tab: string, detail: string | null) => { try { sessionStorage.setItem(KEY, JSON.stringify({ tab, detail })); } catch { /* ignore */ } };
