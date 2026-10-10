# Safe upgrade for a tournament that is already running

This update can be **committed and deployed first, with no database change**. It was built so the live site keeps working
exactly as it does today until you choose to upgrade the database.

## What happens when you deploy this update (before touching the database)

* The public site, standings, fixtures, bracket and the admin panel keep working as today. Results, corrections, adding
  fixtures, Settings (branding) all work. Nothing is written to a column that does not exist yet.
* Admin pages show a yellow notice: *"New features will switch on after a one-time database upgrade."*
* New features that need the upgrade stay hidden until then: **extra matches**, **choosing who goes to the next round**,
  **brackets for any number of players**, and **Finish the bracket**.
* Two small fixes apply immediately: the Add fixture form now suggests the next free match number for the round you pick
  (previously switching round reset it to 1), and players without a photo get initials avatars.

## Do these in order

1. **Commit and push this repository** to GitHub. Vercel redeploys automatically. Check the live site and Admin → Results once.
2. *(Optional safety copy)* In Supabase → SQL Editor:
   ```sql
   create table backup_players as select * from public.players;
   create table backup_matches as select * from public.matches;
   alter table backup_players enable row level security;
   alter table backup_matches enable row level security;
   ```
3. Note your numbers (run before and after step 4; they must be identical):
   ```sql
   select (select count(*) from players) p, (select count(*) from matches) m,
          (select count(*) from matches where status='COMPLETED') done;
   ```
4. Run **`supabase/migrations/003_extra_matches_manual_advance.sql`** once in the SQL Editor (Supabase will show a
   "destructive operations" warning because the script replaces its own rules and triggers; that is expected).
   It changes no players, fixtures, scores, winners, dates or standings, and your tournament **keeps automatic advancement**.
   It is safe to run twice.
5. Reload the admin. The yellow notice disappears. Add the first-round fixtures and the later rounds' matches under **Fixtures** (players can stay TBD), and place who advances in **Admin → Bracket → Advance players**. There is no automatic draw.
6. When you are happy, remove the spare copies: `drop table backup_players, backup_matches;`

## If something looks wrong

Nothing here deletes data. If counts differ after step 4, stop and restore from the spare tables from step 2
(`insert into ... select * from backup_...`) or ask for help before doing anything else.
