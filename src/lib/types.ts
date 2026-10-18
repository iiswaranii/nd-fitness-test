export type Sport = 'walk' | 'run' | 'ride';
export type Category = 'activity' | 'habit';
export type Metric = 'distance' | 'days' | 'count';

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  /** activity challenges */
  sport: Sport | null;
  metric: Metric | null;
  daily_min: number | null; // metric=days: km needed for a day to count
  min_km: number | null; // metric=count: km needed for an activity to count
  /** habit challenges */
  habit_key: string | null;
  daily_target: number | null; // per-day target (ml, minutes, clock minutes…)
  /** km (distance), days (days / habit), or activities (count) */
  target: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  reg_opens: string;
  join_by: string;
  /** Optional audience. All null/empty = everyone can see and join. */
  aud_min_age: number | null;
  aud_max_age: number | null;
  aud_countries: string[] | null;
  aud_states: string[] | null;
  cancelled: boolean;
  created_at: string;
  /** joined-in fields */
  member_count: number;
  joined: boolean;
  my_daily_target: number | null;
  /** Daily reminder time for this member, "HH:MM" in their own time zone, or null for none. */
  my_reminder: string | null;
};

export type NewChallenge = Omit<Challenge, 'id' | 'created_at' | 'member_count' | 'joined' | 'my_daily_target' | 'my_reminder' | 'cancelled'>;

export type Activity = {
  id: string; // Strava activity id
  sport: Sport;
  name: string;
  date: string; // local YYYY-MM-DD
  time: string; // local HH:MM
  km: number;
  moving_s: number;
  elapsed_s: number;
  elev_m: number | null;
  source: 'sync' | 'link' | 'manual';
  /** The link the member pasted (test mode can't resolve short links). */
  url?: string;
};

export type HabitLog = {
  challenge_id: string;
  date: string;
  value: number;
  entries: number[];
};

export type Participant = {
  user_id: string;
  name: string;
  city: string | null;
  strava_connected: boolean;
  joined_at: string;
  activities: Activity[];
  logs: HabitLog[];
};


export const SPORTS: Record<Sport, { name: string; verb: string; plural: string; color: string; icon: string }> = {
  walk: { name: 'Walking', verb: 'Walk', plural: 'walks', color: 'var(--walk)', icon: 'walk' },
  run: { name: 'Running', verb: 'Run', plural: 'runs', color: 'var(--run)', icon: 'run' },
  ride: { name: 'Cycling', verb: 'Ride', plural: 'rides', color: 'var(--ride)', icon: 'ride' },
};

export type MemberStat = {
  user_id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  joined_at: string;
  strava_connected: boolean;
  challenges: number;        // challenges ever joined
  live_challenges: number;   // joined challenges that are active or upcoming
  last_active: string | null; // last day with an activity or a habit log (YYYY-MM-DD)
  /** Age group only (e.g. "30–44"), never the date of birth. */
  age_band: string;
};

/** Private to the member: never visible to admins or other members. */
export type Health = { dob: string | null; mobile?: string | null; height_cm: number | null; weight_kg: number | null; updated_at: string | null };
