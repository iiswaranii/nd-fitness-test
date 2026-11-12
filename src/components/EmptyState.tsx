import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Short, warm lines for empty screens. One is picked per screen per day, so it doesn't flicker. */
const LINES = [
  'Small steps every day add up to big changes.',
  'The best time to start was yesterday. The next best time is today.',
  'You don’t have to be fast. You just have to keep going.',
  'Strong bodies are built one ordinary day at a time.',
  'Show up for yourself today. Tomorrow will thank you.',
  'Every walk counts. Every glass of water counts. You count.',
  'Healthy habits are easier together.',
  'Progress, not perfection.',
];

function lineFor(seed: string): string {
  const d = new Date();
  let h = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LINES[h % LINES.length];
}

/** A friendly empty state: icon, what's going on, a motivating line, and what to do next. */
export function EmptyState({ icon = 'trophy', title, text, quote = true, seed = '', children }: {
  icon?: string; title: string; text?: ReactNode; quote?: boolean; seed?: string; children?: ReactNode;
}) {
  return (
    <div className="card empty empty-rich">
      <span className="empty-ic" aria-hidden="true"><Icon name={icon} /></span>
      <p className="strong">{title}</p>
      {text ? <p className="small muted">{text}</p> : null}
      {quote ? <p className="empty-quote">“{lineFor(seed || title)}”</p> : null}
      {children}
    </div>
  );
}
