import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { useStore } from '../lib/store';

export function TabBar() {
  const { isAdmin, newIds } = useStore();
  // Red count = new challenges the member hasn't looked at yet. Seeing them (or joining) clears it.
  const openCount = newIds.size;
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
          <span className="tab-pill" aria-hidden="true"><Icon name={t.icon} /></span>
          <span className="tab-l">{t.label}</span>
          {'badge' in t && t.badge ? <span className="tab-badge" aria-label={`${t.badge} new`}>{t.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}
