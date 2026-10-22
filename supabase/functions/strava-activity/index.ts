// Adds one walk / run / ride from a pasted Strava link. No Strava connection.
//  1. Resolve the link to the real activity id (strava.app.link share links redirect to it).
//  2. Public activity page → title, type, local date/time, athlete, visibility (must be Everyone).
//     Distance and moving time are suggested from the activity's public GPS track (Strava Labs Flyby);
//     the member reviews and can correct every field, then the app calls again with `manual` to save.
//     A pasted Embed code (with token) uses Strava's own embed numbers instead.
//  3. No GPS track (treadmill, indoor) → { needsStats }; the member types distance and time (`manual`).
// Ownership: each member first links their Strava *profile* (action 'link-profile' → athlete id). An activity
// is accepted only when Strava says it was recorded by that same athlete id. Each activity once, each athlete
// linked to one member.
import { admin, cors, json, requireUser } from '../_shared/common.ts';
import { athleteNameFromPage, BROWSER_UA, embedUrl, resolveLink, FLYBY_HEADERS, flybyMatchesUrl, flybyUrl, parseActivityPage, summaryFromFlyby, parseEmbed, parsePageFacts, resolveShortLink, sportOf, statsFromFlyby, type Sport } from '../_shared/strava.ts';

const NOT_FOUND = 'We couldn’t open this activity. Check that the link is right and the activity isn’t set to “Only you” in Strava.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Please log in again.' }, 401);
    const body = await req.json().catch(() => ({}));
    const db = admin();

    // ---- link the member's Strava profile (Strava → You → Share → Copy link) ----
    if (body.action === 'link-profile') {
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      const m = url.match(/https?:\/\/[^\s"'<>]+/);
      const aid = m ? await resolveLink(m[0], 'athletes').catch(() => null) : null;
      if (!aid) return json({ error: 'That isn’t a Strava profile link. In Strava, open your profile, tap Share, then Copy link.' }, 400);
      const { data: taken } = await db.from('profiles').select('id').eq('strava_athlete_id', aid).neq('id', user.id).maybeSingle();
      if (taken) return json({ error: 'This Strava profile is already linked to another member. If it’s yours, ask the admin to help.' }, 409);
      const pr = await fetch(`https://www.strava.com/athletes/${aid}`, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-GB,en;q=0.9' } }).catch(() => null);
      if (pr && pr.status === 404) return json({ error: 'We couldn’t find that Strava profile. Check the link and try again.' }, 404);
      const name = pr?.ok ? athleteNameFromPage(await pr.text()) : null;
      const { error } = await db.from('profiles').update({
        strava_athlete_id: aid, strava_athlete_name: name ?? 'Strava athlete', strava_connected: true, strava_connected_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
      return json({ linked: true, athleteId: aid, athleteName: name });
    }

    const { data: me } = await db.from('profiles').select('strava_athlete_id, strava_athlete_name, strava_connected').eq('id', user.id).single();
    const myAid = me?.strava_athlete_id ? String(me.strava_athlete_id) : null;
    if (!myAid) return json({ needsProfile: true, error: 'First link your Strava profile, so we know which activities are yours.' }, 428);
    const notMine = (by: string | null) => json({ error: `This activity was recorded by ${by ?? 'someone else'} on Strava, not by your linked Strava profile${me?.strava_athlete_name ? ` (${me.strava_athlete_name})` : ''}. You can only add your own activities.` }, 403);
    const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
    const token = typeof body.token === 'string' && /^[\w-]{4,80}$/.test(body.token) ? body.token : null;
    let id: string | null = typeof body.id === 'string' && /^\d{6,20}$/.test(body.id) ? body.id : null;
    if (!id && typeof body.shortUrl === 'string') id = await resolveShortLink(body.shortUrl).catch(() => null);
    if (!id) return json({ error: 'We couldn’t find an activity in that link. In Strava, open the activity, tap Share, then Copy link.' }, 400);

    const { data: dup } = await db.from('activities').select('user_id, removed_at').eq('id', id).maybeSingle();
    // An activity the member removed earlier can be added again (it comes back instead of being a duplicate).
    const restoring = !!dup && dup.user_id === user.id && !!dup.removed_at;
    if (dup && !restoring) return json({ error: dup.user_id === user.id ? 'You’ve already added this activity.' : 'This activity was already added by another member.' }, 409);

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
      const summary = async () => {
        const mr = await fetch(flybyMatchesUrl(id!), { headers: { 'User-Agent': BROWSER_UA, ...FLYBY_HEADERS } }).catch(() => null);
        return mr?.ok ? summaryFromFlyby(await mr.json().catch(() => null), id!) : null;
      };
      if (body.confirm === true) {
        // ---- 3. save Strava's own numbers, exactly (fetched again here, never taken from the app) ----
        const sum = await summary();
        if (!sum) return json({ error: 'We couldn’t read this activity from Strava just now. Please try again.' }, 502);
        distanceM = sum.distanceM; seconds = sum.elapsedS ?? 0; elapsed = sum.elapsedS;
        athleteId = sum.athleteId ?? athleteId;
        if (sum.startUtc) startUtc = new Date(sum.startUtc * 1000).toISOString().replace('.000Z', 'Z');
        if (!(seconds > 0)) return json({ error: 'Strava didn’t share this activity’s time. Please try again.' }, 502);
      } else if (!m) {
        // ---- 2c. Strava's own summary via Strava Labs Flyby (distance, elapsed time, athlete id) ----
        // Nothing is saved yet: the member checks (and can correct) the numbers first.
        const sum = await summary();
        if (sum?.athleteId && sum.athleteId !== myAid) return notMine(athleteName);
        if (sum) {
          if (sum.activityType && !sportType) { sportType = sum.activityType; sport = sportOf(sportType); }
          return json({ needsStats: true, preview: {
            id, title: title ?? sum.name, sportType, sport, date, time, athleteName,
            km: sum.distanceM / 1000, seconds: sum.elapsedS, measured: true, partial: false, official: true,
          } });
        }
        // ---- 2d. fallback: measure the public GPS track (misses parts hidden by a privacy zone) ----
        const fr = await fetch(flybyUrl(id), { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }).catch(() => null);
        const st = fr?.ok ? statsFromFlyby(await fr.json().catch(() => null)) : null;
        const ok = !!st && st.distanceM >= 50;
        let partial = false;
        if (ok && facts?.startLocal) {
          const local = Date.parse(facts.startLocal.slice(0, 19) + 'Z') / 1000;
          if (Number.isFinite(local)) { const gap = (((st!.startUtc - local) % 900) + 900) % 900; partial = gap > 90 && gap < 810; }
        }
        return json({ needsStats: true, preview: {
          id, title, sportType, sport, date, time, athleteName,
          km: ok ? st!.distanceM / 1000 : null,
          seconds: ok ? (st!.movingS || st!.elapsedS) : null,
          measured: ok, partial,
        } });
      } else {
        // ---- 3b. no Strava numbers available (no GPS, or Strava Labs down): the member typed them ----
        if (!athleteId) athleteId = (await summary())?.athleteId ?? null;
        const km = Number(m.km), secs = Number(m.seconds);
        const ms = typeof m.sport === 'string' && ['walk', 'run', 'ride'].includes(m.sport) ? m.sport as Sport : null;
        if (ms) sport = ms;
        if (!(km >= 0.1 && km <= (sport === 'ride' ? 400 : 120))) return json({ error: 'Enter the distance in km, as shown in Strava.' }, 400);
        if (!(secs >= 60 && secs <= 24 * 3600)) return json({ error: 'Enter the time, as shown in Strava.' }, 400);
        if (typeof m.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && m.date <= today) { if (m.date !== date) time = null; date = m.date; }
        distanceM = km * 1000; seconds = Math.round(secs);
        source = 'manual';
      }
    }
    if (!date) date = today;

    if (!sport) return json({ error: `This is a ${sportType ?? 'different'} activity. Only walks, hikes, runs and rides count.` }, 400);

    // ---- ownership: Strava's athlete id for this activity must be the member's linked profile ----
    if (!athleteId) athleteId = (await (async () => {
      const mr = await fetch(flybyMatchesUrl(id!), { headers: { 'User-Agent': BROWSER_UA, ...FLYBY_HEADERS } }).catch(() => null);
      return mr?.ok ? summaryFromFlyby(await mr.json().catch(() => null), id!) : null;
    })())?.athleteId ?? null;
    if (!athleteId) return json({ error: 'We couldn’t confirm on Strava who recorded this activity. Please try again in a little while.' }, 503);
    if (athleteId !== myAid) return notMine(athleteName);
    const firstLink = false;

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
    const { error } = restoring
      ? await db.from('activities').update({ ...row, removed_at: null }).eq('id', id).eq('user_id', user.id)
      : await db.from('activities').insert(row);
    if (error) throw error;
    return json({ activity: row, athleteName: athleteName ?? me?.strava_athlete_name ?? 'Strava athlete', firstLink });
  } catch (e) {
    console.error(e);
    return json({ error: 'Couldn’t add that activity. Please try again.' }, 500);
  }
});
