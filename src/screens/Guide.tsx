import { Screen } from '../components/Screen';
import { BrandMark } from '../components/BrandMark';

const img = (name: string) => `${import.meta.env.BASE_URL}guide/${name}.webp`;

type Step = { title: string; line: string; shot?: string; flow?: string[] };
const STEPS: Step[] = [
  { title: 'Join a challenge', line: 'Open Challenges, pick one, tap Join.', shot: 'join' },
  { title: 'Link Strava once', line: 'Paste your Strava profile link. Only your own walks can be added.', shot: 'strava-link' },
  { title: 'Add your walk, run or ride', line: 'After recording in Strava:', flow: ['Strava', 'Share', 'Copy link', 'Paste here'], shot: 'add' },
  { title: 'Log habits every day', line: 'On Today, tap a habit and answer.', shot: 'log' },
  { title: 'Set a reminder', line: 'Pick any time. We remind you only if you haven’t logged.', shot: 'reminder' },
  { title: 'Climb the leaderboard', line: 'Finish in the top 3 to win a trophy.', shot: 'podium' },
];

/** Profile → How to use the app. Pictures first, one line each. */
export default function Guide() {
  return (
    <Screen back>
      <div className="stack loose">
        <div className="row" style={{ gap: 12 }}>
          <BrandMark size={48} />
          <div>
            <p className="eyebrow">Namdhari Fitness Connect</p>
            <h1 className="h1" style={{ fontSize: 26 }}>How it works</h1>
          </div>
        </div>
        {STEPS.map((s, i) => (
          <section key={s.title} className="gstep">
            <div className="gstep-h"><span className="n">{i + 1}</span><b>{s.title}</b></div>
            <p className="small muted" style={{ marginTop: -6 }}>{s.line}</p>
            {s.flow ? (
              <div className="gflow" aria-label={s.flow.join(', then ')}>
                {s.flow.map((f, k) => <span key={f}>{k ? <i aria-hidden="true">→</i> : null}{f}</span>)}
              </div>
            ) : null}
            {s.shot ? <div className="gshot"><img src={img(s.shot)} alt={`${s.title}: app screen`} loading="lazy" /></div> : null}
          </section>
        ))}
        <p className="legal">Questions? Ask your challenge admin.</p>
      </div>
    </Screen>
  );
}
