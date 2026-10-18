// Adds one walk / run / ride from a pasted Strava link. No Strava connection.
//  1. Resolve the link to the real activity id (strava.app.link share links redirect to it).
//  2. Read the public embed page → type, date, distance, time (works when the activity is visible to Everyone).
//  3. Otherwise read what the public activity page still shows (title, type, date, athlete) and return
//     { needsStats } so the member types distance and time; the app then calls again with `manual`.
// The member's first link ties their account to that Strava athlete; later links must be by the same athlete,
// and each activity can be added by only one member.
import { admin, cors, json, requireUser } from '../_shared/common.ts';
import { BROWSER_UA, embedUrl, parseActivityPage, parseEmbed, resolveShortLink, type Sport } from '../_shared/strava.ts';

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

    // ---- 2. full numbers from the embed page ----
    let source: 'link' | 'manual' = 'link';
    let sport: Sport | null = null, sportType: string | null = null, date: string | null = null, time: string | null = null;
    let title: string | null = null, athleteName: string | null = null, athleteId: string | null = null;
    let distanceM: number | null = null, seconds: number | null = null, elevM: number | null = null;

    const er = await fetch(embedUrl(id, token), { headers }).catch(() => null);
    if (er?.status === 429) return json({ error: 'Strava is busy right now. Please try again in a few minutes.' }, 429);
    const ep = er?.ok ? parseEmbed(await er.text(), today) : null;
    if (ep && ep.distanceM !== null && ep.date) {
      ({ sport, sportType, date, time, title, athleteName, athleteId, distanceM, seconds, elevM } = ep);
    } else {
      // ---- 3. public page (title, type, date, athlete) + numbers typed by the member ----
      const pr = await fetch(`https://www.strava.com/activities/${id}`, { headers }).catch(() => null);
      const pp = pr?.ok ? parseActivityPage(await pr.text()) : null;
      if (!pp || (!pp.sport && !pp.sportType)) return json({ error: NOT_FOUND }, 404);
      ({ sport, sportType, date, title, athleteName, athleteId } = pp);
      if (!sport) return json({ error: `This is a ${sportType} activity. Only walks, hikes, runs and rides count.` }, 400);

      const m = body.manual;
      if (!m) {
        return json({ needsStats: true, preview: { id, title, sportType, sport, date, athleteName } });
      }
      const km = Number(m.km), secs = Number(m.seconds);
      if (!(km >= 0.1 && km <= (sport === 'ride' ? 400 : 120))) return json({ error: 'Enter the distance in km, as shown in Strava.' }, 400);
      if (!(secs >= 60 && secs <= 24 * 3600)) return json({ error: 'Enter the time, as shown in Strava.' }, 400);
      if (!date) date = typeof m.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && m.date <= today ? m.date : today;
      distanceM = Math.round(km * 1000); seconds = Math.round(secs); source = 'manual';
    }

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
      start_utc: `${date}T${time ?? '12:00:00'}Z`,
      local_date: date,
      local_time: time ?? '00:00:00',
      distance_m: distanceM,
      moving_s: seconds ?? 0,
      elapsed_s: seconds ?? 0,
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
