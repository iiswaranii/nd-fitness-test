# Namdhari Fitness Connect

A phone app (installable web app) for community fitness and healthy-habit challenges.
Members sign in with Google or an email code, join challenges, log habits, and add walks, runs and rides by pasting a Strava activity link.
Admins create challenges, see insights and download Excel/CSV.

## Try it now (no setup)

```bash
npm install
npm run dev          # test mode while .env.local has VITE_DEMO_AUTH=true — starts empty, data stays in the browser, every code is 123456
```

## Go live — checklist

Everything below is free.

| # | Step | Where |
|---|------|-------|
| 1 | Create a Supabase project (free tier) | supabase.com |
| 2 | Email codes: Auth → Email Templates → "Magic Link" and "Confirm signup": put `{{ .Token }}` in the body (6-digit code). Auth → Providers → Email: on, Phone: off. For more than ~3 emails/hour add free SMTP (e.g. Resend, Brevo) under Auth → SMTP | Supabase |
| 3 | Google: create an OAuth client (Web) in Google Cloud Console, redirect `https://<ref>.supabase.co/auth/v1/callback`; paste Client ID/secret in Auth → Providers → Google | Google Cloud |
| 4 | Auth → URL Configuration: Site URL = your app URL; add `https://your-app/auth/callback` to Redirect URLs | Supabase |
| 5 | Free push keys: `npx web-push generate-vapid-keys` | terminal |
| 6 | Copy `supabase/.secrets.env.example` → `supabase/.secrets.env`, fill it, then `PROJECT_REF=<ref> ./scripts/go-live.sh` — creates the whole database and deploys server functions | terminal |
| 7 | Reminders schedule: Database → Extensions → enable `pg_cron`, `pg_net`; run the `cron.schedule` block in `supabase/migrations/20261016180000_notifications.sql` | SQL Editor |
| 8 | Deploy the app on Vercel (free): import the folder, add env vars from `.env.example` (`VITE_DEMO_AUTH=false`) | vercel.com |
| 9 | Sign up first, on your phone: **the very first account becomes the owner (admin)** automatically. Everyone after is a member. More admins: `update public.profiles set role='admin' where email='…';` | your phone |

No CLI? Paste `supabase/setup.sql` into the SQL Editor (whole database in one go) and deploy functions from the dashboard.
`send-reminders` must have "Verify JWT" turned off (already set in `supabase/config.toml`).

## How it works

- **Phone-only.** In production the app shows install steps (Android: Install button; iPhone: Share → Add to Home Screen) until it is opened from the Home Screen. Laptops see a QR code. Admins may use a laptop (`VITE_ALLOW_DESKTOP_ADMIN`).
- **Screens.** Safe areas for notch, camera cut-out, status bar and gesture bar; small phones (≤340 px), foldables (folded, unfolded, dual-screen) and landscape are handled in `src/styles/global.css`.
- **Sign-in.** Email code or Google, no password, works in every country. After the first code, name + country + state are required; birthday, mobile number, height and weight are optional and private (admins only see an age band).
- **Strava (links only).** No Strava login or API keys. A member pastes an activity link (Strava → Share → Copy link); the `strava-activity` function reads Strava's public embed page (`strava-embeds.com/activity/<id>`) for type, date, distance and time. The activity must be visible to *Everyone*, or the member pastes the Share → Embed code (it carries a token). The first link ties the member to that Strava athlete; later links must be by the same athlete, and each activity can be added only once. Parser: `supabase/functions/_shared/strava.ts`.
- **Security.** Every table has row-level security. Admin rights come only from `profiles.role`, which members cannot change.

## Database (supabase/migrations)

| File | What it adds |
|------|-------------|
| 20261014000000_members_and_strava | profiles, Strava tokens (server-only), new-user trigger |
| 20261016000000_challenges_habits_activities | challenges, members, habit logs, activities |
| 20261016120000_profiles_boards_insights | private health table, leaderboards, admin insights |
| 20261016180000_notifications | push subscriptions, reminder settings |
| 20261016200000_birthdays_audiences | birthday, challenge audiences (age / country / state) |
| 20261018000000_email_signin_strava_links | private mobile number, Strava by link only (drops the old token table) |

Strava note: reading activity pages automatically isn't an official Strava API, so Strava may change or block it at any time. If links stop working, the app shows a clear error and nothing else breaks; the fix is updating the parser in `_shared/strava.ts`.
