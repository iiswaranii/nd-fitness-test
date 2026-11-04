import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Dual-pane mode for unfolded foldables and tablets: two tabs side by side, each with its own
 * tab bar, scrolling and back history. On a hinged screen each pane sits on one side of the fold.
 */
export type Pane = 'single' | 'left' | 'right';
export const PaneContext = createContext<Pane>('single');
export const usePane = () => useContext(PaneContext);

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

const KEY = 'ndf-pane2';
export const readRightPath = (left: string) => {
  let p: string | null = null;
  try { p = sessionStorage.getItem(KEY); } catch { /* ignore */ }
  if (p && p !== left) return p;
  return left === '/challenges' || left.startsWith('/c/') ? '/' : '/challenges';
};
export const saveRightPath = (p: string) => { try { sessionStorage.setItem(KEY, p); } catch { /* ignore */ } };
