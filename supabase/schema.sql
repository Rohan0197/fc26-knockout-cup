-- =============================================================================
--  FC 26 KNOCKOUT CUP  -  database schema
--  Run this once in Supabase  ->  SQL Editor  ->  New query  ->  Run.
--  Safe to re-run: everything is CREATE OR REPLACE / IF NOT EXISTS.
--
--  Design rules
--   * Wins / losses / points are NEVER stored. They are derived from completed matches
--     (see the player_standings view).
--   * The database - not the frontend - enforces the rules: no draws, the winner is derived
--     from the scores, the winner advances to the next round, corrections re-route the bracket.
--   * Public visitors can only READ. Every write requires a row in public.admins.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADMINS
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER so policies on other tables can call it without exposing the admins table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- 2. TOURNAMENT SETTINGS (single row)
-- -----------------------------------------------------------------------------
create table if not exists public.tournament_settings (
  id         int primary key default 1 check (id = 1),
  name       text not null default 'FC 26 Knockout Cup' check (length(trim(name)) > 0),
  subtitle   text not null default 'The Road to the Final',
  organizer  text not null default 'IT Committee, IIM Bodh Gaya',
  updated_at timestamptz not null default now()
);
insert into public.tournament_settings (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. PLAYERS
-- -----------------------------------------------------------------------------
create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  short_name text check (short_name is null or length(short_name) <= 12),
  avatar_url text,
  club       text,
  created_at timestamptz not null default now()
);
-- Prevent accidental duplicates ("rohan dongre" == "Rohan  Dongre ").
create unique index if not exists players_name_unique
  on public.players (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

-- -----------------------------------------------------------------------------
-- 4. MATCHES
-- -----------------------------------------------------------------------------
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  round         text not null
                check (round in ('ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL')),
  match_number  int  not null check (match_number > 0),
  player1_id    uuid references public.players (id) on delete set null,
  player2_id    uuid references public.players (id) on delete set null,
  player1_score int  check (player1_score between 0 and 99),
  player2_score int  check (player2_score between 0 and 99),
  winner_id     uuid references public.players (id) on delete set null,
  status        text not null default 'UPCOMING'
                check (status in ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED')),
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),

  unique (round, match_number),
  check (player1_id is null or player2_id is null or player1_id <> player2_id),

  -- A COMPLETED match must be fully and consistently filled in. No draws, ever.
  constraint completed_match_is_consistent check (
    status <> 'COMPLETED' or (
      player1_id is not null and player2_id is not null
      and player1_score is not null and player2_score is not null
      and player1_score <> player2_score
      and winner_id = case when player1_score > player2_score then player1_id else player2_id end
    )
  ),
  -- ...and nothing but a COMPLETED match may carry a result.
  constraint only_completed_has_result check (
    status = 'COMPLETED' or (
      player1_score is null and player2_score is null
      and winner_id is null and completed_at is null
    )
  )
);

create index if not exists matches_round_idx  on public.matches (round, match_number);
create index if not exists matches_status_idx on public.matches (status);
create index if not exists matches_p1_idx     on public.matches (player1_id);
create index if not exists matches_p2_idx     on public.matches (player2_id);

-- -----------------------------------------------------------------------------
-- 5. BRACKET HELPERS + TRIGGERS
-- -----------------------------------------------------------------------------
create or replace function public.next_round(r text)
returns text
language sql
immutable
as $$
  select case r
    when 'ROUND_OF_64'   then 'ROUND_OF_32'
    when 'ROUND_OF_32'   then 'ROUND_OF_16'
    when 'ROUND_OF_16'   then 'QUARTER_FINAL'
    when 'QUARTER_FINAL' then 'SEMI_FINAL'
    when 'SEMI_FINAL'    then 'FINAL'
    else null
  end;
$$;

-- BEFORE INSERT/UPDATE: validate and derive the winner from the scores.
create or replace function public.matches_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'COMPLETED'
     and new.status = 'COMPLETED'
     and (new.player1_id is distinct from old.player1_id
          or new.player2_id is distinct from old.player2_id
          or new.round <> old.round
          or new.match_number <> old.match_number) then
    raise exception 'Players, round and match number of a completed match cannot be changed. Correct the result instead.';
  end if;

  if new.status = 'COMPLETED' then
    if new.player1_id is null or new.player2_id is null then
      raise exception 'Both players must be assigned before a result can be recorded.';
    end if;
    if new.player1_score is null or new.player2_score is null then
      raise exception 'Both scores are required.';
    end if;
    if new.player1_score < 0 or new.player2_score < 0 then
      raise exception 'Scores cannot be negative.';
    end if;
    if new.player1_score = new.player2_score then
      raise exception 'Draws are not permitted in this tournament.';
    end if;

    -- The winner is ALWAYS derived from the scores; the client can never choose one.
    new.winner_id := case when new.player1_score > new.player2_score
                          then new.player1_id else new.player2_id end;
    if tg_op = 'INSERT' or old.status <> 'COMPLETED' or new.completed_at is null then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.player1_score := null;
    new.player2_score := null;
    new.winner_id     := null;
    new.completed_at  := null;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_before_write on public.matches;
create trigger matches_before_write
  before insert or update on public.matches
  for each row execute function public.matches_before_write();

-- AFTER INSERT/UPDATE: put the winner into the right slot of the next round.
--   match N of a round feeds match ceil(N/2) of the next round:
--   odd N -> player1 slot, even N -> player2 slot.
-- When a result is CORRECTED so the winner changes, the slot is re-pointed automatically.
-- If the next match was already played the change is refused (correct that result first),
-- so the bracket can never contradict itself.
create or replace function public.matches_advance_winner()
returns trigger
language plpgsql
as $$
declare
  nr      text;
  target  public.matches;
  slot    int;
  current_occupant uuid;
begin
  nr := public.next_round(new.round);
  if nr is null then
    return null;
  end if;

  if tg_op = 'UPDATE' and new.winner_id is not distinct from old.winner_id then
    return null;
  end if;
  if tg_op = 'INSERT' and new.winner_id is null then
    return null;
  end if;

  select * into target
  from public.matches
  where round = nr and match_number = (new.match_number + 1) / 2
  for update;

  if not found then
    return null;
  end if;

  slot := case when new.match_number % 2 = 1 then 1 else 2 end;
  current_occupant := case slot when 1 then target.player1_id else target.player2_id end;

  if current_occupant is not distinct from new.winner_id then
    return null;
  end if;

  if target.status = 'COMPLETED' then
    raise exception 'Cannot change this winner: the next match (% %) has already been played. Correct that result first.',
      replace(initcap(replace(target.round, '_', ' ')), 'Of', 'of'), target.match_number;
  end if;

  if slot = 1 then
    update public.matches set player1_id = new.winner_id where id = target.id;
  else
    update public.matches set player2_id = new.winner_id where id = target.id;
  end if;

  return null;
end;
$$;

drop trigger if exists matches_advance_winner on public.matches;
create trigger matches_advance_winner
  after insert or update on public.matches
  for each row execute function public.matches_advance_winner();

-- BEFORE DELETE: a played match can only disappear through reset_tournament().
create or replace function public.matches_before_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'COMPLETED' and coalesce(current_setting('app.allow_reset', true), '') <> 'on' then
    raise exception 'Completed matches cannot be deleted. Correct the result, or reset the whole tournament.';
  end if;
  return old;
end;
$$;

drop trigger if exists matches_before_delete on public.matches;
create trigger matches_before_delete
  before delete on public.matches
  for each row execute function public.matches_before_delete();

-- -----------------------------------------------------------------------------
-- 6. STANDINGS  (derived - never stored)
-- -----------------------------------------------------------------------------
create or replace view public.player_standings
with (security_invoker = true)
as
with base as (
  select
    p.id as player_id,
    p.name,
    p.short_name,
    p.avatar_url,
    p.club,
    p.created_at,
    count(m.id) filter (where m.winner_id = p.id)::int  as wins,
    count(m.id) filter (where m.winner_id <> p.id)::int as losses
  from public.players p
  left join public.matches m
    on m.status = 'COMPLETED'
   and p.id in (m.player1_id, m.player2_id)
  group by p.id
)
select
  player_id, name, short_name, avatar_url, club,
  wins,
  losses,
  wins                       as points,          -- win = 1, loss = 0
  wins + losses              as matches_played,
  case when wins + losses = 0 then 0
       else round(wins::numeric / (wins + losses) * 100) end as win_percentage,
  row_number() over (
    order by wins desc,
             (wins + losses = 0) asc,
             case when wins + losses = 0 then 0 else wins::numeric / (wins + losses) end desc,
             created_at asc,
             name asc
  )::int as rank
from base;

-- -----------------------------------------------------------------------------
-- 7. RPC FUNCTIONS (called by the admin panel)
-- -----------------------------------------------------------------------------

-- Enter OR correct a result. One code path for both.
create or replace function public.submit_match_result(
  p_match_id uuid,
  p_player1_score int,
  p_player2_score int
)
returns public.matches
language plpgsql
as $$
declare
  m public.matches;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if p_player1_score is null or p_player2_score is null then
    raise exception 'Both scores are required.';
  end if;
  if p_player1_score < 0 or p_player2_score < 0 then
    raise exception 'Scores cannot be negative.';
  end if;
  if p_player1_score = p_player2_score then
    raise exception 'Draws are not permitted in this tournament.';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if m.status = 'CANCELLED' then
    raise exception 'This match was cancelled.';
  end if;
  if m.player1_id is null or m.player2_id is null then
    raise exception 'Both players must be assigned before a result can be recorded.';
  end if;

  update public.matches
     set player1_score = p_player1_score,
         player2_score = p_player2_score,
         status        = 'COMPLETED'
   where id = p_match_id
  returning * into m;

  return m;
end;
$$;

-- Build the whole empty bracket from an ordered list of players (2, 4, 8, 16, 32 or 64).
-- Pairs are (1,2), (3,4) ... ; later rounds are created empty and fill themselves in.
create or replace function public.generate_bracket(p_player_ids uuid[])
returns int
language plpgsql
as $$
declare
  n       int := coalesce(array_length(p_player_ids, 1), 0);
  r       text;
  size    int;
  i       int;
  is_first boolean := true;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if exists (select 1 from public.matches) then
    raise exception 'Fixtures already exist. Reset the tournament before generating a new bracket.';
  end if;
  if n not in (2, 4, 8, 16, 32, 64) then
    raise exception 'A knockout bracket needs 2, 4, 8, 16, 32 or 64 players (got %).', n;
  end if;
  if (select count(distinct x) from unnest(p_player_ids) as x) <> n then
    raise exception 'The same player appears more than once.';
  end if;
  if exists (
    select 1 from unnest(p_player_ids) as x where not exists (select 1 from public.players where id = x)
  ) then
    raise exception 'Unknown player in list.';
  end if;

  r := case n when 64 then 'ROUND_OF_64' when 32 then 'ROUND_OF_32' when 16 then 'ROUND_OF_16'
             when 8 then 'QUARTER_FINAL' when 4 then 'SEMI_FINAL' else 'FINAL' end;
  size := n / 2;

  while r is not null loop
    for i in 1 .. size loop
      if is_first then
        insert into public.matches (round, match_number, player1_id, player2_id)
        values (r, i, p_player_ids[2 * i - 1], p_player_ids[2 * i]);
      else
        insert into public.matches (round, match_number) values (r, i);
      end if;
    end loop;
    is_first := false;
    r := public.next_round(r);
    size := size / 2;
  end loop;

  return n - 1;
end;
$$;

-- Wipe every fixture and result (players are kept). Used to start a bracket over.
create or replace function public.reset_tournament()
returns void
language plpgsql
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  perform set_config('app.allow_reset', 'on', true);
  delete from public.matches where true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY  -  public READ, admin WRITE
-- -----------------------------------------------------------------------------
alter table public.admins              enable row level security;
alter table public.players             enable row level security;
alter table public.matches             enable row level security;
alter table public.tournament_settings enable row level security;

-- admins: a signed-in user may only see their own row (lets the app check "am I an admin?").
drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- players
drop policy if exists "players are public"   on public.players;
drop policy if exists "admins insert players" on public.players;
drop policy if exists "admins update players" on public.players;
drop policy if exists "admins delete players" on public.players;
create policy "players are public"    on public.players for select using (true);
create policy "admins insert players" on public.players for insert to authenticated with check (public.is_admin());
create policy "admins update players" on public.players for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete players" on public.players for delete to authenticated using (public.is_admin());

-- matches
drop policy if exists "matches are public"   on public.matches;
drop policy if exists "admins insert matches" on public.matches;
drop policy if exists "admins update matches" on public.matches;
drop policy if exists "admins delete matches" on public.matches;
create policy "matches are public"    on public.matches for select using (true);
create policy "admins insert matches" on public.matches for insert to authenticated with check (public.is_admin());
create policy "admins update matches" on public.matches for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete matches" on public.matches for delete to authenticated using (public.is_admin());

-- settings
drop policy if exists "settings are public"   on public.tournament_settings;
drop policy if exists "admins update settings" on public.tournament_settings;
create policy "settings are public"    on public.tournament_settings for select using (true);
create policy "admins update settings" on public.tournament_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Only signed-in users may call the write RPCs (they also check is_admin() internally).
revoke execute on function public.submit_match_result(uuid, int, int) from public, anon;
revoke execute on function public.generate_bracket(uuid[])           from public, anon;
revoke execute on function public.reset_tournament()                 from public, anon;
grant  execute on function public.submit_match_result(uuid, int, int) to authenticated;
grant  execute on function public.generate_bracket(uuid[])           to authenticated;
grant  execute on function public.reset_tournament()                 to authenticated;

-- -----------------------------------------------------------------------------
-- 8b. DATA API PRIVILEGES
--   Newer Supabase projects no longer open new tables to the API automatically, so grant
--   exactly what is needed. Row Level Security above still decides WHICH rows each role may
--   touch: visitors (anon) can only read; writes need an admin.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.players, public.matches, public.tournament_settings, public.player_standings
  to anon, authenticated;
grant select on public.admins to authenticated;

grant insert, update, delete on public.players, public.matches to authenticated;
grant update on public.tournament_settings to authenticated;

grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. REALTIME  (public pages update live when the admin saves)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['players', 'matches', 'tournament_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 10. MAKE YOURSELF AN ADMIN (run after creating your user in Authentication -> Users)
-- -----------------------------------------------------------------------------
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
