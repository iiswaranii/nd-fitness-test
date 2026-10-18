import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { HABITS, HABIT_GROUPS, groupOf, habitGoalText, type Habit } from '../lib/habits';

const KIND_LABEL = { amount: 'Log an amount', check: 'Yes / no each day', time: 'Log a time' } as const;

/** Searchable, grouped list of the built-in habits. Opens as a full-height sheet on phones. */
export function HabitPicker({ value, onChange }: { value: string | null; onChange: (h: Habit) => void }) {
  const [open, setOpen] = useState(false);
  const sel = HABITS.find((h) => h.key === value) ?? null;
  return (
    <div className="field">
      <span className="label" id="hp-l">Healthy habit</span>
      <button type="button" className="select-btn" aria-labelledby="hp-l" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {sel ? (
          <>
            <span className="sp" style={{ ['--c' as string]: groupOf(sel).color, width: 36, height: 36 }}><Icon name={groupOf(sel).icon} /></span>
            <span className="grow"><span className="strong" style={{ display: 'block' }}>{sel.name}</span><span className="small muted">{sel.group} · {KIND_LABEL[sel.kind]}</span></span>
          </>
        ) : (
          <><Icon name="search" /><span className="grow ph">Search {HABITS.length} habits…</span></>
        )}
        <Icon name="chev" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Choose a habit">
        <PickerBody value={value} onPick={(h) => { onChange(h); setOpen(false); }} />
      </Sheet>
    </div>
  );
}

function PickerBody({ value, onPick }: { value: string | null; onPick: (h: Habit) => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('All');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return HABITS.filter((h) => (group === 'All' || h.group === group) &&
      words.every((w) => `${h.name} ${h.group} ${h.unit ?? ''} ${h.ask ?? ''}`.toLowerCase().includes(w)));
  }, [q, group]);
  useEffect(() => setActive(0), [q, group]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let lastGroup = '';
  return (
    <div className="stack tight">
      <h2 className="h2">Choose a habit</h2>
      <div className="input-wrap">
        <input
          className="input"
          style={{ paddingLeft: 44 }}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="hp-list"
          aria-activedescendant={results[active] ? `hp-${results[active].key}` : undefined}
          placeholder="Search: water, sleep, sugar, yoga…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === 'Enter' && results[active]) { e.preventDefault(); onPick(results[active]); }
          }}
          autoComplete="off"
        />
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" /></span>
      </div>
      <div className="chip-row">
        {['All', ...HABIT_GROUPS.map((g) => g.name)].map((g) => (
          <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <div className="combo-list" id="hp-list" role="listbox" ref={listRef} aria-label="Habits">
        {results.length ? results.map((h, i) => {
          const g = groupOf(h);
          const head = h.group !== lastGroup ? <div className="combo-group" role="presentation">{h.group}</div> : null;
          lastGroup = h.group;
          return (
            <div key={h.key}>
              {head}
              <button type="button" id={`hp-${h.key}`} data-i={i} role="option" aria-selected={i === active || h.key === value}
                className="combo-opt" onClick={() => onPick(h)} onMouseEnter={() => setActive(i)}>
                <span className="sp" style={{ ['--c' as string]: g.color }}><Icon name={g.icon} /></span>
                <span className="grow">
                  <span className="strong" style={{ display: 'block' }}>{h.name}</span>
                  <span className="small muted">{KIND_LABEL[h.kind]}{h.kind !== 'check' ? ` · default: ${habitGoalText(h, h.goal ?? 0).toLowerCase()}` : ''}</span>
                </span>
                {h.key === value ? <Icon name="check" /> : null}
              </button>
            </div>
          );
        }) : <p className="small muted" style={{ padding: 16 }}>No habit matches “{q}”. Try another word.</p>}
      </div>
    </div>
  );
}
