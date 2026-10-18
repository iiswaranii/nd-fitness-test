import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { canJoin } from '../lib/progress';

export function TabBar() {
  const { isAdmin, challenges } = useStore();
  // Red count = live challenges still open to join. Joining one lowers it; at zero it disappears.
  const openCount = challenges.filter(canJoin).length;
  const tabs = [
    { to: '/', label: 'Today', icon: 'home', end: true },
    { to: '/challenges', label: 'Challenges', icon: 'trophy', badge: openCount },
    { to: '/activity', label: 'Activity', icon: 'pulse' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: 'grid', end: false }] : []),
    { to: '/profile', label: 'Profile', icon: 'user' },
  ];
  return (
    <nav className="tabbar" style={{ ['--n' as string]: tabs.length }} aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tab">
          <Icon name={t.icon} />
          <span>{t.label}</span>
          {'badge' in t && t.badge ? <span className="tab-badge" aria-label={`${t.badge} open to join`}>{t.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}
