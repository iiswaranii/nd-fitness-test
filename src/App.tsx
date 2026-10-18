import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AboutYou from './screens/AboutYou';
import TestInbox from './screens/admin/TestInbox';
import Insights from './screens/admin/Insights';
import type { ReactNode } from 'react';
import { useSession } from './lib/session';
import { StoreProvider, useStore } from './lib/store';
import Welcome from './screens/Welcome';
import Start from './screens/Start';
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
  const { needsProfile } = useSession();
  const loc = useLocation();
  // New members (code or Google) give their name and location before anything else.
  if (needsProfile && loc.pathname !== '/about') return <Navigate to="/about" replace />;
  return (
    <StoreProvider>
      <Routes>
        <Route path="/about" element={<AboutYou />} />
        <Route path="/admin/insights" element={<AdminOnly><Insights /></AdminOnly>} />
        <Route path="/admin/inbox" element={<AdminOnly><TestInbox /></AdminOnly>} />
        <Route path="/" element={<Today />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/c/:id" element={<ChallengeDetail />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/profile" element={<Profile />} />
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
      <Route path="/signup" element={<Navigate to="/start" replace />} />
      <Route path="/login" element={<Navigate to="/start" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/*" element={user ? <Member><MemberRoutes /></Member> : <Routes><Route path="/" element={<Welcome />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>} />
    </Routes>
  );
}
