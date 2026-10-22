import { TrophiesPage, BadgesPage } from './screens/Awards';
import Guide from './screens/Guide';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AboutYou from './screens/AboutYou';
import TestInbox from './screens/admin/TestInbox';
import Insights from './screens/admin/Insights';
import type { ReactNode } from 'react';
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
  const resetting = (() => { try { return sessionStorage.getItem(RESET_FLAG) === '1'; } catch { return false; } })();
  // New members: 1. email code (done) → 2. create a password → 3. name and location.
  if (profile && (!profile.password_set || resetting) && loc.pathname !== '/set-password') return <Navigate to="/set-password" replace />;
  if (profile?.password_set && !resetting && needsProfile && loc.pathname !== '/about') return <Navigate to="/about" replace />;
  return (
    <StoreProvider>
      <Routes>
        <Route path="/about" element={<AboutYou />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/admin/insights" element={<AdminOnly><Insights /></AdminOnly>} />
        <Route path="/admin/inbox" element={<AdminOnly><TestInbox /></AdminOnly>} />
        <Route path="/" element={<Today />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/c/:id" element={<ChallengeDetail />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/trophies" element={<TrophiesPage />} />
        <Route path="/badges" element={<BadgesPage />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/admin" element={<AdminOnly><AdminHome /></AdminOnly>} />
        <Route path="/admin/new" element={<AdminOnly><CreateChallenge /></AdminOnly>} />
        <Route path="/admin/c/:id" element={<AdminOnly><AdminChallenge /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StoreProvider>
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
