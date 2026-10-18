/**
 * Built-in healthy-habit catalog. Admins pick one when creating a habit challenge;
 * members log it daily. Each habit declares how it is logged:
 *
 *  - amount: a number with a unit, added up through the day (water, steps, minutes).
 *            `presets` are quick-add buttons; `goal` is the default daily target.
 *            `dir: 'atMost'` means staying at or under the target counts (sugar, screen time).
 *  - check:  done / not done for the day (no junk food, cold shower).
 *  - time:   a clock time (sleep, wake-up). `dir: 'before'` means at or before the target time counts.
 */

export type HabitKind = 'amount' | 'check' | 'time';

export type Habit = {
  key: string;
  name: string;
  group: HabitGroup;
  kind: HabitKind;
  /** amount: unit label shown to members */
  unit?: string;
  /** amount: default daily target; time: default target "HH:MM" encoded as minutes after midnight */
  goal?: number;
  dir?: 'atLeast' | 'atMost' | 'before' | 'after';
  presets?: number[];
  /** amount: largest single step for the +/− stepper */
  step?: number;
  /** check: question asked when logging */
  ask?: string;
  hint?: string;
  /** Show a leaderboard of total amount (only where more is genuinely better). */
  board?: boolean;
};

export type HabitGroup =
  | 'Hydration' | 'Sleep' | 'Nutrition' | 'Movement' | 'Mind' | 'Digital' | 'Self-care' | 'Lifestyle';

export const HABIT_GROUPS: { name: HabitGroup; color: string; icon: string }[] = [
  { name: 'Hydration', color: 'var(--ride)', icon: 'drop' },
  { name: 'Sleep', color: '#7C6BE6', icon: 'moon' },
  { name: 'Nutrition', color: 'var(--good)', icon: 'leaf' },
  { name: 'Movement', color: 'var(--walk)', icon: 'walk' },
  { name: 'Mind', color: '#C25FD6', icon: 'sparkle' },
  { name: 'Digital', color: 'var(--run)', icon: 'phone' },
  { name: 'Self-care', color: '#14A3A3', icon: 'heart' },
  { name: 'Lifestyle', color: 'var(--warn)', icon: 'sun' },
];

const t = (h: number, m = 0) => h * 60 + m;

export const HABITS: Habit[] = [
  // Hydration
  { key: 'water', name: 'Drink water', group: 'Hydration', kind: 'amount', unit: 'ml', goal: 3000, dir: 'atLeast', presets: [150, 250, 500, 750], step: 250, hint: 'Tap a glass or bottle size each time you drink.' },
  { key: 'warm-water-morning', name: 'Warm water on waking', group: 'Hydration', kind: 'check', ask: 'Did you drink warm water first thing this morning?' },
  { key: 'no-soft-drinks', name: 'No soft drinks', group: 'Hydration', kind: 'check', ask: 'Did you skip soft drinks and packaged juices today?' },
  { key: 'tea-coffee-limit', name: 'Limit tea or coffee', group: 'Hydration', kind: 'amount', unit: 'cups', goal: 2, dir: 'atMost', presets: [1], step: 1 },
  { key: 'coconut-water', name: 'Coconut water or lemon water', group: 'Hydration', kind: 'check', ask: 'Did you have coconut or lemon water today?' },

  // Sleep
  { key: 'sleep-early', name: 'Sleep early', group: 'Sleep', kind: 'time', goal: t(22, 0), dir: 'before', hint: 'Log the time you went to bed.' },
  { key: 'wake-early', name: 'Wake up early', group: 'Sleep', kind: 'time', goal: t(5, 30), dir: 'before', hint: 'Log the time you got up.' },
  { key: 'amrit-vela', name: 'Rise before sunrise', group: 'Sleep', kind: 'time', goal: t(4, 30), dir: 'before' },
  { key: 'sleep-hours', name: 'Sleep 7+ hours', group: 'Sleep', kind: 'amount', unit: 'hours', goal: 7, dir: 'atLeast', presets: [6, 7, 8], step: 0.5 },
  { key: 'no-screens-bed', name: 'No screens in bed', group: 'Sleep', kind: 'check', ask: 'Did you keep your phone away for 30 minutes before sleep?' },
  { key: 'no-late-dinner', name: 'Dinner 2 hours before bed', group: 'Sleep', kind: 'check', ask: 'Did you finish dinner at least 2 hours before sleeping?' },
  { key: 'no-nap-long', name: 'Short daytime nap only', group: 'Sleep', kind: 'check', ask: 'Did you keep any nap under 30 minutes?' },

  // Nutrition
  { key: 'less-sugar', name: 'Cut down sugar', group: 'Nutrition', kind: 'amount', unit: 'tsp', goal: 4, dir: 'atMost', presets: [1, 2], step: 1, hint: 'Count teaspoons of added sugar, including in tea and sweets.' },
  { key: 'no-sugar', name: 'No added sugar', group: 'Nutrition', kind: 'check', ask: 'Did you avoid added sugar and sweets today?' },
  { key: 'no-junk', name: 'No junk food', group: 'Nutrition', kind: 'check', ask: 'Did you skip fried snacks, chips and fast food today?' },
  { key: 'fruit', name: 'Eat fruit', group: 'Nutrition', kind: 'amount', unit: 'servings', goal: 2, dir: 'atLeast', presets: [1], step: 1 },
  { key: 'vegetables', name: 'Eat vegetables', group: 'Nutrition', kind: 'amount', unit: 'servings', goal: 3, dir: 'atLeast', presets: [1], step: 1 },
  { key: 'salad', name: 'Salad with a meal', group: 'Nutrition', kind: 'check', ask: 'Did you have a bowl of salad today?' },
  { key: 'less-salt', name: 'Less salt', group: 'Nutrition', kind: 'check', ask: 'Did you avoid extra salt, pickles and salty snacks today?' },
  { key: 'home-food', name: 'Eat home-cooked food', group: 'Nutrition', kind: 'check', ask: 'Were all your meals home-cooked today?' },
  { key: 'no-maida', name: 'No maida (refined flour)', group: 'Nutrition', kind: 'check', ask: 'Did you avoid maida, white bread and biscuits today?' },
  { key: 'less-oil', name: 'Less oil and ghee', group: 'Nutrition', kind: 'check', ask: 'Did you keep oil and ghee light today?' },
  { key: 'protein', name: 'Protein with every meal', group: 'Nutrition', kind: 'check', ask: 'Did each meal include dal, paneer, curd, sprouts or another protein?' },
  { key: 'sprouts', name: 'Sprouts or nuts daily', group: 'Nutrition', kind: 'check', ask: 'Did you have sprouts or a handful of nuts today?' },
  { key: 'breakfast', name: 'Never skip breakfast', group: 'Nutrition', kind: 'check', ask: 'Did you eat a proper breakfast today?' },
  { key: 'no-snacking-night', name: 'No late-night snacking', group: 'Nutrition', kind: 'check', ask: 'Did you avoid eating after dinner?' },
  { key: 'mindful-eating', name: 'Eat slowly, no screens', group: 'Nutrition', kind: 'check', ask: 'Did you eat your main meal without a screen?' },
  { key: 'fasting-window', name: '12-hour overnight fast', group: 'Nutrition', kind: 'check', ask: 'Was there a 12-hour gap between dinner and breakfast?' },
  { key: 'millets', name: 'Include millets', group: 'Nutrition', kind: 'check', ask: 'Did you eat bajra, jowar, ragi or another millet today?' },

  // Movement
  { key: 'steps', board: true, name: 'Daily steps', group: 'Movement', kind: 'amount', unit: 'steps', goal: 10000, dir: 'atLeast', presets: [1000, 2000, 5000], step: 500, hint: 'Copy today’s total from your phone’s step counter.' },
  { key: 'stretching', board: true, name: 'Stretching', group: 'Movement', kind: 'amount', unit: 'min', goal: 10, dir: 'atLeast', presets: [5, 10, 15], step: 5 },
  { key: 'yoga', board: true, name: 'Yoga', group: 'Movement', kind: 'amount', unit: 'min', goal: 20, dir: 'atLeast', presets: [10, 20, 30], step: 5 },
  { key: 'surya-namaskar', board: true, name: 'Surya namaskar', group: 'Movement', kind: 'amount', unit: 'rounds', goal: 12, dir: 'atLeast', presets: [4, 6, 12], step: 1 },
  { key: 'pushups', board: true, name: 'Push-ups', group: 'Movement', kind: 'amount', unit: 'reps', goal: 30, dir: 'atLeast', presets: [5, 10, 20], step: 5 },
  { key: 'squats', board: true, name: 'Squats', group: 'Movement', kind: 'amount', unit: 'reps', goal: 40, dir: 'atLeast', presets: [10, 20], step: 5 },
  { key: 'plank', board: true, name: 'Plank', group: 'Movement', kind: 'amount', unit: 'sec', goal: 90, dir: 'atLeast', presets: [30, 45, 60], step: 15 },
  { key: 'stairs', board: true, name: 'Take the stairs', group: 'Movement', kind: 'amount', unit: 'floors', goal: 10, dir: 'atLeast', presets: [1, 3, 5], step: 1 },
  { key: 'walk-after-meal', board: true, name: 'Walk after meals', group: 'Movement', kind: 'amount', unit: 'min', goal: 10, dir: 'atLeast', presets: [5, 10, 15], step: 5 },
  { key: 'stand-hourly', name: 'Stand up every hour', group: 'Movement', kind: 'check', ask: 'Did you get up and move at least once every hour while working?' },
  { key: 'strength', board: true, name: 'Strength workout', group: 'Movement', kind: 'amount', unit: 'min', goal: 20, dir: 'atLeast', presets: [10, 20, 30], step: 5 },
  { key: 'skipping', board: true, name: 'Skipping rope', group: 'Movement', kind: 'amount', unit: 'skips', goal: 300, dir: 'atLeast', presets: [50, 100, 200], step: 50 },
  { key: 'gardening', board: true, name: 'Gardening or outdoor work', group: 'Movement', kind: 'amount', unit: 'min', goal: 20, dir: 'atLeast', presets: [10, 20, 30], step: 5 },

  // Mind
  { key: 'meditation', board: true, name: 'Meditation or simran', group: 'Mind', kind: 'amount', unit: 'min', goal: 15, dir: 'atLeast', presets: [5, 10, 15, 30], step: 5 },
  { key: 'pranayama', board: true, name: 'Pranayama / breathing', group: 'Mind', kind: 'amount', unit: 'min', goal: 10, dir: 'atLeast', presets: [5, 10, 15], step: 5 },
  { key: 'morning-prayer', name: 'Morning prayer', group: 'Mind', kind: 'check', ask: 'Did you do your morning prayer today?' },
  { key: 'evening-prayer', name: 'Evening prayer', group: 'Mind', kind: 'check', ask: 'Did you do your evening prayer today?' },
  { key: 'gratitude', name: 'Write 3 gratitudes', group: 'Mind', kind: 'check', ask: 'Did you write down three things you’re grateful for?' },
  { key: 'reading', board: true, name: 'Read', group: 'Mind', kind: 'amount', unit: 'pages', goal: 10, dir: 'atLeast', presets: [5, 10, 20], step: 5 },
  { key: 'journal', name: 'Journal', group: 'Mind', kind: 'check', ask: 'Did you write in your journal today?' },
  { key: 'learn', board: true, name: 'Learn something new', group: 'Mind', kind: 'amount', unit: 'min', goal: 15, dir: 'atLeast', presets: [10, 15, 30], step: 5 },
  { key: 'no-anger', name: 'Stay calm, no anger', group: 'Mind', kind: 'check', ask: 'Did you stay calm and avoid losing your temper today?' },
  { key: 'seva', name: 'Seva / help someone', group: 'Mind', kind: 'check', ask: 'Did you do one kind act or seva today?' },

  // Digital
  { key: 'screen-time', name: 'Limit screen time', group: 'Digital', kind: 'amount', unit: 'min', goal: 120, dir: 'atMost', presets: [15, 30, 60], step: 15, hint: 'Check your phone’s screen time and log the total, leaving out calls.' },
  { key: 'no-phone-morning', name: 'No phone first hour', group: 'Digital', kind: 'check', ask: 'Did you avoid your phone for the first hour after waking?' },
  { key: 'social-media-limit', name: 'Limit social media', group: 'Digital', kind: 'amount', unit: 'min', goal: 30, dir: 'atMost', presets: [10, 15, 30], step: 5 },
  { key: 'phone-free-meals', name: 'Phone-free meals', group: 'Digital', kind: 'check', ask: 'Did you keep your phone away during meals?' },
  { key: 'digital-sunset', name: 'Screens off by night', group: 'Digital', kind: 'time', goal: t(21, 30), dir: 'before', hint: 'Log when you put screens away.' },

  // Self-care
  { key: 'sunlight', board: true, name: 'Morning sunlight', group: 'Self-care', kind: 'amount', unit: 'min', goal: 15, dir: 'atLeast', presets: [5, 10, 15], step: 5 },
  { key: 'oral-care', name: 'Brush twice a day', group: 'Self-care', kind: 'check', ask: 'Did you brush in the morning and at night?' },
  { key: 'bp-check', name: 'Check blood pressure', group: 'Self-care', kind: 'check', ask: 'Did you measure your blood pressure today?' },
  { key: 'sugar-check', name: 'Check blood sugar', group: 'Self-care', kind: 'check', ask: 'Did you check your blood sugar today?' },
  { key: 'medicines', name: 'Take medicines on time', group: 'Self-care', kind: 'check', ask: 'Did you take your medicines on time today?' },
  { key: 'posture', name: 'Good posture', group: 'Self-care', kind: 'check', ask: 'Did you check and correct your posture through the day?' },
  { key: 'eye-breaks', name: 'Eye breaks (20-20-20)', group: 'Self-care', kind: 'check', ask: 'Did you rest your eyes every 20 minutes while on screens?' },
  { key: 'weigh-in', name: 'Track your weight', group: 'Self-care', kind: 'amount', unit: 'kg', goal: 0, dir: 'atLeast', presets: [], step: 0.1, hint: 'Weigh yourself at the same time each morning.' },

  // Lifestyle
  { key: 'no-tobacco', name: 'No tobacco', group: 'Lifestyle', kind: 'check', ask: 'Did you stay tobacco-free today?' },
  { key: 'no-alcohol', name: 'No alcohol', group: 'Lifestyle', kind: 'check', ask: 'Did you stay alcohol-free today?' },
  { key: 'family-time', name: 'Family time', group: 'Lifestyle', kind: 'amount', unit: 'min', goal: 30, dir: 'atLeast', presets: [15, 30, 60], step: 15 },
  { key: 'call-elder', name: 'Call an elder or friend', group: 'Lifestyle', kind: 'check', ask: 'Did you call a parent, elder or friend today?' },
  { key: 'nature', board: true, name: 'Time in nature', group: 'Lifestyle', kind: 'amount', unit: 'min', goal: 20, dir: 'atLeast', presets: [10, 20, 30], step: 10 },
  { key: 'declutter', name: 'Declutter one thing', group: 'Lifestyle', kind: 'check', ask: 'Did you tidy or declutter one space today?' },
  { key: 'plan-day', name: 'Plan tomorrow', group: 'Lifestyle', kind: 'check', ask: 'Did you plan tomorrow before sleeping?' },
  { key: 'save-money', name: 'No unplanned spending', group: 'Lifestyle', kind: 'check', ask: 'Did you avoid impulse buys today?' },
];

export const habitByKey = (key?: string | null) => HABITS.find((h) => h.key === key) ?? null;
export const groupOf = (h: Habit) => HABIT_GROUPS.find((g) => g.name === h.group)!;

export function fmtClock(min: number): string {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  const ap = h < 12 ? 'am' : 'pm';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtAmount(v: number, unit?: string): string {
  const n = Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

/** Plain-language daily goal, e.g. "3,000 ml or more a day", "In bed by 10:00 pm". */
export function habitGoalText(h: Habit, target: number): string {
  if (h.kind === 'check') return h.name;
  if (h.kind === 'time') {
    const verb = h.key.startsWith('wake') || h.key === 'amrit-vela' ? 'Up' : h.key === 'digital-sunset' ? 'Screens off' : 'In bed';
    return `${verb} by ${fmtClock(target)}`;
  }
  if (h.key === 'weigh-in') return 'Log your weight';
  return `${fmtAmount(target, h.unit)} ${h.dir === 'atMost' ? 'or less' : 'or more'} a day`;
}

/** Does a day's logged value meet the daily target? */
export function dayMet(h: Habit, target: number, value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (h.kind === 'check') return value >= 1;
  if (h.key === 'weigh-in') return value > 0;
  if (h.kind === 'time') {
    // Bed times after midnight (00:00–04:00) count as late, not early.
    const norm = (m: number) => (h.dir === 'before' && target >= t(18) && m < t(4) ? m + 1440 : m);
    return h.dir === 'after' ? norm(value) >= norm(target) : norm(value) <= norm(target);
  }
  return h.dir === 'atMost' ? value <= target : value >= target;
}
