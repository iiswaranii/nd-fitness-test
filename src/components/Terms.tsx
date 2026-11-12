import { useEffect, useRef, useState } from 'react';
import { Button } from './Form';
import { Icon } from './Icon';

/** Change this whenever the wording below changes; members' acceptance is stored with the version. */
export const TERMS_VERSION = '2026-11-12';

type Point = { icon: string; tone: 'warn' | 'info' | 'good'; title: string; text: string };

const POINTS: Point[] = [
  { icon: 'user', tone: 'info', title: 'You take part by your own choice',
    text: 'Joining is voluntary. You decide how much to do each day and you do it at your own risk.' },
  { icon: 'heart', tone: 'warn', title: 'Check with your doctor first',
    text: 'Talk to a doctor before you start if you have a heart, blood pressure, sugar, kidney, joint or breathing condition, are pregnant, are recovering from illness or surgery, or take regular medicine.' },
  { icon: 'shield', tone: 'warn', title: 'You are fit to do this',
    text: 'By joining you confirm you are physically fit for this challenge and know of no medical reason not to take part.' },
  { icon: 'alert', tone: 'warn', title: 'Stop if something feels wrong',
    text: 'Stop at once and get medical help if you feel chest pain, dizziness, faintness, unusual breathlessness or pain. No target is worth an injury.' },
  { icon: 'drop', tone: 'info', title: 'Habits have safe limits too',
    text: 'Water, fasting, sleep and diet goals are general guides. Don’t go beyond what is safe for your body or what your doctor has advised.' },
  { icon: 'walk', tone: 'info', title: 'Stay safe outdoors',
    text: 'Follow traffic rules, use footpaths and lit routes, carry water, and avoid extreme heat, cold or pollution.' },
  { icon: 'info', tone: 'info', title: 'Not medical advice',
    text: 'The app, its targets and its messages are for motivation only. They are not medical advice and don’t replace a doctor.' },
  { icon: 'users', tone: 'info', title: 'Under 18? Ask a parent',
    text: 'Members under 18 should join only with the permission and supervision of a parent or guardian.' },
  { icon: 'eye', tone: 'info', title: 'What others can see',
    text: 'Your name, city and progress appear on the challenge leaderboard. Your birthday, height and weight are never shown.' },
  { icon: 'check', tone: 'good', title: 'Play fair',
    text: 'Log only your own, real activities and habits. Admins may remove entries that don’t look genuine.' },
  { icon: 'shield', tone: 'info', title: 'Responsibility',
    text: 'As far as the law allows, the organisers, admins and the app are not responsible for any injury, illness, loss or damage that happens while you take part. You accept the risks that come with exercise and lifestyle changes.' },
];

/**
 * Health and safety terms, shown before every join. The member has to scroll to the end,
 * tick the box, and only then can they join. Acceptance is saved with the membership.
 */
export function TermsStep({ title, busy, onAgree, onBack }: { title: string; busy?: boolean; onAgree: () => void; onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const check = () => { if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setRead(true); };
    check();
    el.addEventListener('scroll', check, { passive: true });
    return () => el.removeEventListener('scroll', check);
  }, []);
  return (
    <div className="stack">
      <div className="stack tight">
        <p className="eyebrow">Before you join</p>
        <h2 className="h1" style={{ fontSize: 26 }}>Your health comes first</h2>
        <p className="small muted">Please read these points for <span className="strong">{title}</span>. Scroll to the end to continue.</p>
      </div>
      <div className="terms-box" ref={box} tabIndex={0} aria-label="Terms of taking part">
        {POINTS.map((p) => (
          <div key={p.title} className={`term ${p.tone}`}>
            <span className="term-ic" aria-hidden="true"><Icon name={p.icon} /></span>
            <div><b>{p.title}</b><p>{p.text}</p></div>
          </div>
        ))}
        <p className="term-end"><Icon name="check" /> You’ve reached the end</p>
      </div>
      {!read ? <p className="small muted center-text terms-hint"><Icon name="chev" className="ic" /> Scroll down to read all {POINTS.length} points</p> : null}
      <label className={`terms-agree${read ? '' : ' off'}`}>
        <input type="checkbox" checked={ok} disabled={!read} onChange={(e) => setOk(e.target.checked)} />
        <span>I have read and agree. I’m taking part by my own choice, I’m fit to do this, and I’ve taken my doctor’s advice where needed.</span>
      </label>
      <Button className="tint" disabled={!read || !ok} loading={busy} onClick={onAgree}>Agree and join</Button>
      <Button variant="ghost" onClick={onBack}>Back</Button>
    </div>
  );
}
