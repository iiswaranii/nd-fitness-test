import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { DEMO_AUTH } from '../lib/config';

/**
 * Tab page. The shell is pinned to the screen and only the middle part scrolls,
 * so the tab bar is part of the layout and can never drift up (iOS / Android, browser or installed).
 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="app-scroll" data-scroller>
        <main className="page screen-enter">
          {children}
          {DEMO_AUTH ? <p className="demo-banner">Test mode · data stays on this phone</p> : null}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
