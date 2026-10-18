import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/Form';
import { Icon } from '../components/Icon';

const FEATURES = [
  { icon: 'trophy', color: 'var(--walk)', t: 'Community challenges', d: 'Walking, cycling and healthy-habit goals set for your community.' },
  { icon: 'drop', color: 'var(--ride)', t: 'Simple daily logging', d: 'Water, sleep, yoga and more in one tap. Walks come from Strava.' },
  { icon: 'heart', color: 'var(--run)', t: 'Progress together', d: 'Rings, badges and friendly leaderboards to keep you going.' },
];

export default function Welcome() {
  const nav = useNavigate();
  return (
    <Screen>
      <div className="stack loose" style={{ paddingTop: 12 }}>
        <BrandMark />
        <div className="stack tight">
          <h1 className="h1">Namdhari Health &amp; Fitness</h1>
          <p className="lead">Healthy habits and fitness challenges for our community.</p>
        </div>
        <div className="stack">
          {FEATURES.map((f) => (
            <div className="feat" key={f.t}>
              <span className="sp" style={{ ['--c' as string]: f.color }}><Icon name={f.icon} /></span>
              <span><span className="t">{f.t}</span><br /><span className="d">{f.d}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="spacer" />
      <div className="stack tight" style={{ paddingTop: 24 }}>
        <Button onClick={() => nav('/start')}>Get started</Button>
        <p className="legal">New or returning, it’s the same: sign in with Google, or get a code by email.</p>
      </div>
    </Screen>
  );
}
