// Adds one walk / run / ride from a pasted Strava link. No Strava connection.
//  1. Resolve the link to the real activity id (strava.app.link share links redirect to it).
//  2. Public activity page → title, type, local date/time, athlete, visibility (must be Everyone).
//     Distance and moving time come from the activity's public GPS track (Strava Labs Flyby).
//     A pasted Embed code (with token) uses Strava's own embed numbers instead.
//  3. No GPS track (treadmill, indoor) → { needsStats }; the member types distance and time (`manual`).
// The member's first link ties their account to that Strava athlete; later links must be by the same athlete,
// and each activity can be added by only one member.
import { admin, cors, json, requireUser } from '../_shared/common.ts';
import { BROWSER_UA, embedUrl, flybyUrl, parseActivityPage, parseEmbed, parsePageFacts, resolveShortLink, sportOf, statsFromFlyby, type Sport } from '../_shared/strava.ts';

const NOT_FOUND = 'We couldn’t open this activity. Check that the link is right and the activity isn’t set to “Only you” in Strava.';
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Please log in again.' }, 401);
    const body = await req.json().catch(() => ({}));
    const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
    const token = typeof body.token === 'string' && /^[\w-]{4,80}$/.test(body.token) ? body.token : null;
    let id: string | null = typeof body.id === 'string' && /^\d{6,20}$/.test(body.id) ? body.id : null;
    if (!id && typeof body.shortUrl === 'string') id = await resolveShortLink(body.shortUrl).catch(() => null);
    if (!id) return json({ error: 'We couldn’t find an activity in that link. In Strava, open the activity, tap Share, then Copy link.' }, 400);

    const db = admin();
    const { data: dup } = await db.from('activities').select('user_id').eq('id', id).maybeSingle();
    if (dup) return json({ error: dup.user_id === user.id ? 'You’ve already added this activity.' : 'This activity was already added by another member.' }, 409);

    const headers = { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-GB,en;q=0.9' };

    let source: 'link' | 'manual' = 'link';
    let sport: Sport | null = null, sportType: string | null = null, date: string | null = null, time: string | null = null;
    let title: string | null = null, athleteName: string | null = null, athleteId: string | null = null;
    let distanceM: number | null = null, seconds: number | null = null, elapsed: number | null = null, elevM: number | null = null;
    let startUtc: string | null = null;

    // ---- 2a. pasted Embed code (has a token) → Strava's own numbers ----
    const ep = token ? await fetch(embedUrl(id, token), { headers }).then((r) => (r.ok ? r.text() : null)).then((h) => (h ? parseEmbed(h, today) : null)).catch(() => null) : null;
    if (ep && ep.distanceM !== null && ep.date) {
      ({ sport, sportType, date, time, title, athleteName, athleteId, distanceM, seconds, elevM } = ep);
    } else {
      // ---- 2b. public activity page: title, type, local date/time, athlete, visibility ----
      const pr = await fetch(`https://www.strava.com/activities/${id}`, { headers }).catch(() => null);
      if (pr?.status === 429) return json({ error: 'Strava is busy right now. Please try again in a few minutes.' }, 429);
      const html = pr?.ok ? await pr.text() : '';
      const pp = html ? parseActivityPage(html) : null;
      const facts = html ? parsePageFacts(html) : null;
      if (!pp && !facts) return json({ error: NOT_FOUND }, 404);
      if (facts?.visibility && facts.visibility !== 'Everyone') {
        return json({ error: 'This activity isn’t public. In Strava, open it → ⋯ → Edit → Who can view → Everyone, then paste the link again.' }, 403);
      }
      sportType = facts?.sportType ?? pp?.sportType ?? null;
      sport = sportOf(sportType);
      title = facts?.name ?? pp?.title ?? null;
      athleteName = facts?.athleteName ?? pp?.athleteName ?? null;
      athleteId = pp?.athleteId ?? null;
      if (facts?.startLocal && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(facts.startLocal)) {
        date = facts.startLocal.slice(0, 10); time = facts.startLocal.slice(11, 19).padEnd(8, ':00').slice(0, 8);
      } else date = pp?.date ?? null;
      if (!sportType) return json({ error: NOT_FOUND }, 404);
      if (!sport) return json({ error: `This is a ${sportType} activity. Only walks, hikes, runs and rides count.` }, 400);

      const m = body.manual;
      if (!m) {
        // ---- 2c. GPS track from Strava Labs Flyby → distance and moving time ----
        const fr = await fetch(flybyUrl(id), { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }).catch(() => null);
        const st = fr?.ok ? statsFromFlyby(await fr.json().catch(() => null)) : null;
        if (st && st.distanceM >= 50) {
          distanceM = st.distanceM; seconds = st.movingS || st.elapsedS; elapsed = st.elapsedS;
          startUtc = new Date(st.startUtc * 1000).toISOString().replace('.000Z', 'Z');
        } else {
          // No GPS (treadmill, indoor) or Flyby unavailable: the member types the numbers.
          return json({ needsStats: true, preview: { id, title, sportType, sport, date, athleteName } });
        }
      } else {
        const km = Number(m.km), secs = Number(m.seconds);
        if (!(km >= 0.1 && km <= (sport === 'ride' ? 400 : 120))) return json({ error: 'Enter the distance in km, as shown in Strava.' }, 400);
        if (!(secs >= 60 && secs <= 24 * 3600)) return json({ error: 'Enter the time, as shown in Strava.' }, 400);
        if (!date) date = typeof m.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && m.date <= today ? m.date : today;
        distanceM = Math.round(km * 1000); seconds = Math.round(secs); source = 'manual';
      }
    }
    if (!date) date = today;

    if (!sport) return json({ error: `This is a ${sportType ?? 'different'} activity. Only walks, hikes, runs and rides count.` }, 400);
    if (!athleteId && !athleteName) return json({ error: 'We couldn’t tell whose activity this is. Please try again.' }, 422);

    // ---- ownership: first link ties the member to a Strava athlete ----
    const { data: me } = await db.from('profiles').select('strava_athlete_id, strava_athlete_name, strava_connected').eq('id', user.id).single();
    let firstLink = false;
    if (!me?.strava_connected) {
      if (athleteId) {
        const { data: taken } = await db.from('profiles').select('id').eq('strava_athlete_id', athleteId).neq('id', user.id).maybeSingle();
        if (taken) return json({ error: `This activity is by ${athleteName ?? 'another athlete'}, whose Strava is already linked to another member. You can only add your own.` }, 403);
      }
      const { error } = await db.from('profiles').update({
        strava_athlete_id: athleteId, strava_athlete_name: athleteName ?? 'Strava athlete', strava_connected: true, strava_connected_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
      firstLink = true;
    } else {
      const sameId = athleteId && me.strava_athlete_id ? String(me.strava_athlete_id) === athleteId : null;
      const same = sameId ?? (norm(athleteName) === norm(me.strava_athlete_name));
      if (!same) return json({ error: `This activity is by ${athleteName ?? 'another athlete'}. Your account is linked to ${me.strava_athlete_name ?? 'a different Strava athlete'}, so only their activities can be added.` }, 403);
      if (athleteId && !me.strava_athlete_id) await db.from('profiles').update({ strava_athlete_id: athleteId }).eq('id', user.id);
    }

    const row = {
      id,
      user_id: user.id,
      sport,
      name: (title ?? sportType ?? 'Activity').slice(0, 120),
      start_utc: startUtc ?? `${date}T${time ?? '12:00:00'}Z`,
      local_date: date,
      local_time: time ?? '00:00:00',
      distance_m: distanceM,
      moving_s: seconds ?? 0,
      elapsed_s: elapsed ?? seconds ?? 0,
      elev_m: elevM,
      source,
      synced_at: new Date().toISOString(),
    };
    const { error } = await db.from('activities').insert(row);
    if (error) throw error;
    return json({ activity: row, athleteName: athleteName ?? me?.strava_athlete_name ?? 'Strava athlete', firstLink });
  } catch (e) {
    console.error(e);
    return json({ error: 'Couldn’t add that activity. Please try again.' }, 500);
  }
});
