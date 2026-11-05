import { MemoryRouter, UNSAFE_LocationContext, useNavigate } from 'react-router-dom';
import { PaneContext, PaneOpenContext, PaneRootContext, companionOf, isDetail, readDetail, saveDetail, tabOf, useDuo } from './lib/pane';
import { TabBar } from './components/TabBar';
import { AwardsPage } from './screens/Awards';
import Stats from './screens/Stats';
import { ResultsDeck } from './components/ResultsDeck';
import { TrophiesPage, BadgesPage } from './screens/Awards';
import Guide from './screens/Guide';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AboutYou from './screens/AboutYou';
import TestInbox from './screens/admin/TestInbox';
import Insights from './screens/admin/Insights';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from './lib/session';
import { StoreProvider, useStore } from './lib/store';
import Welcome from './screens/Welcome';
import Start, { RESET_FLAG } from './screens/Start';
import Login from './screens/Login';
import SetPassword from './screens/SetPassword';
import Today from './screens/Today';
import Challenges from './screens/Challenges';
import ChallengeDetail from './screens/ChallengeDetail';
import Activity from './screens/Activity';
import Profile from './screens/Profile';
import AdminHome from './screens/admin/AdminHome';
import CreateChallenge from './screens/admin/CreateChallenge';
import AdminChallenge from './screens/admin/AdminChallenge';
import AuthCallback from './screens/AuthCallback';
import { BrandMark } from './components/BrandMark';

function Splash() {
  return (
    <div className="screen center" style={{ alignItems: 'center' }} aria-busy="true">
      <BrandMark size={72} />
    </div>
  );
}

/** Signed-in members only. */
function Member({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useStore();
  const { profile } = useSession();
  if (!profile) return <Splash />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Pages for signed-out visitors; signed-in members go home. */
function Guest({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function MemberRoutes() {
  const { needsProfile, profile } = useSession();
  const loc = useLocation();
  const duo = useDuo() && !!profile?.password_set && !needsProfile;
  const resetting = (() => { try { return sessionStorage.getItem(RESET_FLAG) === '1'; } catch { return false; } })();
  // New members: 1. email code (done) → 2. create a password → 3. name and location.
  if (profile && (!profile.password_set || resetting) && loc.pathname !== '/set-password') return <Navigate to="/set-password" replace />;
  if (profile?.password_set && !resetting && needsProfile && loc.pathname !== '/about') return <Navigate to="/about" replace />;
  return (
    <StoreProvider>
      {duo ? <Duo /> : memberRoutes(true)}
      <ResultsDeck />
    </StoreProvider>
  );
}

/**
 * Two panes, one tab bar. Left: the tab. Right: its companion page, or whatever you opened from the left.
 * Opening a detail page from the left (a challenge, stats, trophies…) moves it to the right and keeps the
 * list on the left, so the two sides never show the same thing.
 */
function Duo() {
  const loc = useLocation();
  const nav = useNavigate();
  const { challenges } = useStore();
  const [leftTab, setLeftTab] = useState(() => (isDetail(loc.pathname) ? tabOf(loc.pathname) : loc.pathname));
  if (!isDetail(loc.pathname) && loc.pathname !== leftTab) setLeftTab(loc.pathname);
  // What's open on the right, and which tab opened it. Switching tabs brings that tab's own page back.
  const [opened, setOpened] = useState<{ tab: string; path: string } | null>(() => { const d = readDetail(leftTab); return d ? { tab: leftTab, path: d } : null; });

  // The left pane only ever shows a tab. A detail page opened there goes to the right instead.
  useEffect(() => {
    if (!isDetail(loc.pathname)) return;
    const path = loc.pathname + loc.search;
    if (loc.key !== 'default') { setOpened({ tab: leftTab, path }); nav(-1); }
    else { setOpened({ tab: tabOf(loc.pathname), path }); nav(tabOf(loc.pathname), { replace: true }); }
  }, [loc, nav, leftTab]);
  const tab = leftTab;
  const detail = opened && opened.tab === tab ? opened.path : null;
  useEffect(() => { saveDetail(tab, detail); }, [tab, detail]);

  const companion = companionOf(tab, challenges);
  const root = detail && tab === '/challenges' && detail.startsWith('/c/') ? detail : companion;
  const entries = detail && detail !== root ? [root, detail] : [root];
  return (
    <div className="duo">
      <div className="duo-panes">
        <PaneContext.Provider value="left">
          <PaneOpenContext.Provider value={entries[entries.length - 1]}>
            <div className="pane" data-scroller>
              {isDetail(loc.pathname) ? null : memberRoutes(true)}
            </div>
          </PaneOpenContext.Provider>
        </PaneContext.Provider>
        <div className="duo-gap" aria-hidden="true" />
        <PaneContext.Provider value="right">
          <PaneRootContext.Provider value={root}>
            <div className="pane" data-scroller>
              {/* A second, independent navigator for the right-hand pane. */}
              <UNSAFE_LocationContext.Provider value={null as never}>
                <MemoryRouter key={entries.join('|')} initialEntries={entries} initialIndex={entries.length - 1}>
                  <RightGuard root={root} onTab={(to) => nav(to)} onRoot={() => { if (detail && detail !== root) setOpened(null); }} />
                  {memberRoutes(false)}
                </MemoryRouter>
              </UNSAFE_LocationContext.Provider>
            </div>
          </PaneRootContext.Provider>
        </PaneContext.Provider>
      </div>
      <TabBar />
    </div>
  );
}

/** If the right pane is asked to show a tab (e.g. "Back to challenges"), that tab opens on the left instead. */
function RightGuard({ root, onTab, onRoot }: { root: string; onTab: (to: string) => void; onRoot: () => void }) {
  const l = useLocation();
  const n = useNavigate();
  useEffect(() => {
    if (l.pathname + l.search === root || l.pathname === root) { onRoot(); return; } // went back to the start page
    if (isDetail(l.pathname)) return;
    onTab(l.pathname + l.search);
    if (l.key !== 'default') n(-1);
  }, [l, n, root, onTab, onRoot]);
  return null;
}

/** All member pages. The setup pages (password, profile) only live in the main pane. */
function memberRoutes(main: boolean) {
  return (
      <Routes>
        {main ? <Route path="/about" element={<AboutYou />} /> : null}
        {main ? <Route path="/set-password" element={<SetPassword />} /> : null}
        <Route path="/admin/insights" element={<AdminOnly><Insights /></AdminOnly>} />
        <Route path="/admin/inbox" element={<AdminOnly><TestInbox /></AdminOnly>} />
        <Route path="/" element={<Today />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/c/:id" element={<ChallengeDetail />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/trophies" element={<TrophiesPage />} />
        <Route path="/badges" element={<BadgesPage />} />
        <Route path="/awards" element={<AwardsPage />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/admin" element={<AdminOnly><AdminHome /></AdminOnly>} />
        <Route path="/admin/new" element={<AdminOnly><CreateChallenge /></AdminOnly>} />
        <Route path="/admin/c/:id" element={<AdminOnly><AdminChallenge /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

export default function App() {
  const { ready, user } = useSession();
  if (!ready) return <Splash />;
  return (
    <Routes>
      <Route path="/start" element={<Guest><Start /></Guest>} />
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/signup" element={<Navigate to="/start" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/*" element={user ? <Member><MemberRoutes /></Member> : <Routes><Route path="/" element={<Welcome />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>} />
    </Routes>
  );
}
