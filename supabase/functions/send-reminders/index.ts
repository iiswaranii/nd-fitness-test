// Runs every 15 minutes (pg_cron). Sends each member's daily reminder at their chosen local time,
// only for active challenges they haven't logged today, at most once a day per challenge.
import { admin, cors, env, json } from '../_shared/common.ts';
import { sendAll, type Sub } from '../_shared/push.ts';

function localNow(tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).reduce<Record<string, string>>((m, p) => { m[p.type] = p.value; return m; }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.headers.get('Authorization') !== `Bearer ${env('CRON_SECRET')}`) return json({ error: 'Not allowed' }, 401);
  try {
    const db = admin();
    const { data: rows } = await db
      .from('challenge_members')
      .select('challenge_id, user_id, reminder_time, last_reminded, challenges!inner(id, title, category, sport, habit_key, start_date, end_date, cancelled)')
      .not('reminder_time', 'is', null)
      .eq('challenges.cancelled', false);
    if (!rows?.length) return json({ sent: 0 });

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id, tz').in('user_id', userIds);
    const subsBy = new Map<string, Sub[]>();
    (subs ?? []).forEach((s) => subsBy.set(s.user_id, [...(subsBy.get(s.user_id) ?? []), s as Sub]));

    let sent = 0;
    for (const r of rows) {
      const mySubs = subsBy.get(r.user_id);
      if (!mySubs?.length) continue;
      const c = r.challenges as unknown as { id: string; title: string; category: string; sport: string | null; start_date: string; end_date: string };
      const { date, minutes } = localNow(mySubs[0].tz || 'Asia/Kolkata');
      if (date < c.start_date || date > c.end_date || r.last_reminded === date) continue;
      const [h, m] = String(r.reminder_time).split(':').map(Number);
      const due = h * 60 + m;
      if (minutes < due || minutes >= due + 15) continue;

      // Skip if they've already done it today.
      const done = c.category === 'habit'
        ? (await db.from('habit_logs').select('day', { count: 'exact', head: true }).eq('user_id', r.user_id).eq('challenge_id', c.id).eq('day', date)).count
        : (await db.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', r.user_id).eq('sport', c.sport).eq('local_date', date)).count;
      if (done) continue;

      sent += await sendAll(db, mySubs, () => ({
        title: c.category === 'habit' ? `Time to log: ${c.title}` : `Time to move: ${c.title}`,
        body: c.category === 'habit' ? 'Tap to log today. It takes a second.' : 'A short walk today keeps your streak going. You’ve got this!',
        url: `c/${c.id}`,
        tag: `rem-${c.id}`,
      }));
      await db.from('challenge_members').update({ last_reminded: date }).eq('challenge_id', c.id).eq('user_id', r.user_id);
    }
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: 'Reminder run failed.' }, 500);
  }
});
