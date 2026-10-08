# FC 26 Knockout Cup

A knockout-only tournament site styled like a modern football-game broadcast: live standings, fixtures,
a dynamic bracket, player cards, and a separate authenticated admin panel.

**Stack:** React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · Supabase (PostgreSQL, Auth, Realtime) · Vite

```
PLAYER → MATCH → RESULT → WIN/LOSS → POINT → KNOCKOUT ADVANCEMENT
```

## How the rules are enforced

The **database is the source of truth**, not the frontend. `supabase/schema.sql` makes the rules impossible to bypass:

| Rule | Where it lives |
|---|---|
| No draws, no negative scores | RPC `submit_match_result`, trigger `matches_before_write`, and a CHECK constraint |
| Winner is derived from the scores (never chosen) | trigger `matches_before_write` |
| Winner advances to the next round (match *N* → match ⌈N/2⌉, odd = player 1, even = player 2) | trigger `matches_advance_winner` |
| Correcting a result re-routes the bracket | same trigger; refused if the next match was already played |
| Wins / losses / points / played / win % are never stored | view `player_standings` + `lib/calculations.ts` |
| Played matches can't be deleted or have their players swapped | triggers; `reset_tournament()` is the only way |
| Duplicate player names blocked (case/space-insensitive) | unique index |
| Public = read only; only admins write | Row Level Security + `public.admins` table |

## 1 · Run it locally (no Supabase needed)

```bash
npm install
npm run dev
```

With no Supabase variables set, **development builds** use a clearly-labelled local demo backend
(sample data in your browser's localStorage, a yellow "Dev demo" pill at the bottom). Admin login there is
`demo@fc26.cup` / `demo1234`. **Production builds never do this** — without Supabase credentials they show a
"Setup required" screen instead of fake data.

## 2 · Connect Supabase (the real thing)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), **Run**. (Safe to re-run.)
3. **Project Settings → API**: copy the *Project URL* and the **anon / public** key.
4. `copy .env.example .env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   > Only the **anon** key goes here. Never put the `service_role` key in a `VITE_` variable —
   > everything with that prefix is shipped to every visitor's browser. The app doesn't need it.
5. **Authentication → Providers → Email**: keep email sign-in on, and **turn off "Allow new users to sign up"**
   so strangers can't create accounts.
6. **Authentication → Users → Add user** — create your admin (email + password).
7. Make that user an admin (SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
8. `npm run dev`, open `/admin`, sign in.

> A signed-in user who is **not** in `public.admins` can sign in but can't read anything privileged or write anything —
> RLS rejects it at the database, not just in the UI.

**Realtime** is switched on by the schema (`players`, `matches`, `tournament_settings` are added to the
`supabase_realtime` publication). Public pages refetch within ~¼ s of an admin saving and flash a "LIVE UPDATE" chip.

### Loading the starting player list (Supabase dashboard)

Export your sign-up sheet as CSV with columns `name` (required) and optionally `short_name`, `club`, `avatar_url`.
Delete any other columns (emails, phone numbers…) first, then in Supabase: **Table Editor → `players` → Insert → Import data from CSV**.
Duplicate names are rejected by the database, so re-importing is safe.

### Upgrading an existing database to 64-player brackets

If you ran `supabase/schema.sql` before 64-player support was added, run
[`supabase/migrations/001_64_player_bracket.sql`](supabase/migrations/001_64_player_bracket.sql) once in the SQL Editor.
It only adds the *Round of 64* / *Round of 32* rounds and the bigger bracket generator. Players and results are untouched.
New setups already include it.

### Optional: demo data in Supabase

[`supabase/seed_demo.sql`](supabase/seed_demo.sql) loads 8 sample players and a quarter-final bracket with two results.
It is **development data only** — do not run it on your real tournament. To remove it: Admin → Bracket → *Reset tournament*,
then delete the players.

## 3 · Running the tournament

1. **Players** – load the starting list once in Supabase (below), then use **Admin → Players** to add, edit or remove anyone later (name required, duplicates blocked, optional club / avatar URL).
2. **Admin → Bracket** – tick 2, 4, 8, 16, 32 or 64 players, *Draw* (random or in order), *Create bracket*. A 64-player bracket starts at the Round of 64 and runs 32 → 16 → quarter-finals → semi-finals → final (63 matches). All rounds are created;
   later rounds fill themselves in.
3. **Admin → Fixtures** – set dates/times, or add/edit single fixtures by hand.
4. **Admin → Results** – *Enter result*. Type two scores; the winner, stats, standings and bracket update everywhere.
   Wrong score? *Edit result* → review → confirm. Everything is recalculated.

You never type wins, losses or points — there is nowhere to.

## Deploying

It's a static site (`npm run build` → `dist/`). Deploy to Vercel, Netlify or Cloudflare Pages, set the two
`VITE_SUPABASE_*` variables in the host's dashboard, and add a rewrite of all paths to `/index.html`
(single-page-app routing). Then add your site URL under Supabase → Authentication → URL configuration.

## Project layout

```
src/
  components/   Navbar, Hero, Standings, PlayerCard, MatchCard, FixtureList, KnockoutBracket,
                TournamentStats, Footer, StadiumBackground, ui/ (modal, skeletons, empty state…), admin/
  pages/        Home, StandingsPage, FixturesPage, BracketPage, PlayersPage,
                admin/ (Layout, Login, Overview, Players, Fixtures, Results, Bracket, Settings)
  lib/          supabase (client), queries (Supabase API), calculations (derived stats),
                bracket (round/advancement rules), demoStore (dev-only backend), api (backend selection)
  hooks/        usePlayers, useMatches, useStandings, useAdminAction
  context/      TournamentContext (data + realtime), AuthContext
  types/  utils/
supabase/       schema.sql (run first) · seed_demo.sql (dev only)
```

## Swapping in real branding

* **Logo:** replace `public/logo.webp` (720px) and `public/logo-sm.webp` (128px); favicon files are `public/favicon.png` and `apple-touch-icon.png`. Currently the IT Committee, IIM Bodh Gaya crest.
* **Name / tagline / organiser:** Admin → Settings (stored in the database).
* **Player photos:** paste an image URL on the player (square or portrait cut-outs work best).
* **Background:** `src/components/StadiumBackground.tsx` is pure CSS/SVG; replace layers with a stadium photo if you have one.
* **Colours:** design tokens at the top of `src/index.css` (`--color-pitch` is the accent green).
