import { Screen } from '../components/Screen';
import { TrophyRack } from '../components/TrophyRack';
import { Badges } from '../components/Badges';

/** Full-screen trophy cabinet (Profile → Show all trophies). */
export function TrophiesPage() {
  return (
    <Screen back>
      <div className="stack">
        <h1 className="h1">Trophies</h1>
        <TrophyRack full />
      </div>
    </Screen>
  );
}

/** Full-screen badge collection (Profile → See all badges). */
export function BadgesPage() {
  return (
    <Screen back>
      <div className="stack">
        <h1 className="h1">Badges</h1>
        <Badges full />
      </div>
    </Screen>
  );
}
