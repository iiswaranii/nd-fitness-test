import { Picker } from './Picker';
import { REMINDER_TIMES } from '../lib/push';

/** "20:05" → "8:05 pm"; empty → "Off". */
export function fmtReminder(v: string | null | undefined) {
  if (!v) return 'Off';
  const [h, m] = v.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * Reminder time: a drop-down with every hour of the day (and "No reminder").
 * value / onChange use "HH:MM" (24h); '' means no reminder.
 */
export function ReminderPicker({ value, onChange, title = 'Remind me at', compact }: {
  value: string; onChange: (v: string) => void; title?: string; compact?: boolean;
}) {
  // Keep an older saved time that isn't on the hour (e.g. 6:15 pm) selectable.
  const options = value && !REMINDER_TIMES.some((o) => o.value === value)
    ? [...REMINDER_TIMES, { value, label: fmtReminder(value) }].sort((a, b) => a.value.localeCompare(b.value))
    : REMINDER_TIMES;
  return <Picker compact={compact} title={title} value={value} options={options} search={false} near="20:00" onChange={onChange} />;
}
