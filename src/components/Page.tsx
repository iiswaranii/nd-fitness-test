import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { DEMO_AUTH } from '../lib/config';

/** Tab page: safe-area padding top and bottom, with the tab bar fixed above the home indicator. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="page screen-enter">
        {children}
        {DEMO_AUTH ? <p className="demo-banner">Test mode · data stays on this phone</p> : null}
      </main>
      <TabBar />
    </div>
  );
}
