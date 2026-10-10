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
  -- MANUAL: the admin decides who goes to the next round. AUTO: winners are placed automatically.
  advancement_mode text not null default 'MANUAL' check (advancement_mode in ('AUTO', 'MANUAL')),
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
                check (round in ('ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'EXTRA')),
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
  -- where the winner goes (set by generate_bracket; lets brackets with byes work)
  next_match_id uuid references public.matches (id),
  next_slot     int  check (next_slot in (1, 2)),

  unique (round, match_number),
  constraint next_link_is_complete check ((next_match_id is null) = (next_slot is null)),
  constraint next_link_not_self check (next_match_id is distinct from id),
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

-- Name of a round from how many participants it starts with: 54 -> ROUND_OF_64, 27 -> ROUND_OF_32 ...
create or replace function public.stage_round(p int)
returns text
language sql
immutable
as $$
  select case
    when p <= 2  then 'FINAL'
    when p <= 4  then 'SEMI_FINAL'
    when p <= 8  then 'QUARTER_FINAL'
    when p <= 16 then 'ROUND_OF_16'
    when p <= 32 then 'ROUND_OF_32'
    else 'ROUND_OF_64'
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

-- AFTER INSERT/UPDATE: put the winner into the slot the match points at.
--   Every match carries next_match_id / next_slot (set when the bracket is generated), so brackets
--   with byes work. Fixtures created by hand (no link) fall back to the classic rule:
--   match N of a round feeds match ceil(N/2) of the next round (odd N -> player1, even N -> player2).
-- When a result is CORRECTED so the winner changes, the slot is re-pointed automatically. If the next
-- match was already played the change is refused (correct that result first), so the bracket can
-- never contradict itself.
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
  -- extra matches are outside the bracket, and in MANUAL mode the admin places every player by hand
  if new.round = 'EXTRA' then
    return null;
  end if;
  if coalesce((select advancement_mode from public.tournament_settings where id = 1), 'MANUAL') = 'MANUAL' then
    return null;
  end if;

  if tg_op = 'UPDATE' and new.winner_id is not distinct from old.winner_id then
    return null;
  end if;
  if tg_op = 'INSERT' and new.winner_id is null then
    return null;
  end if;

  if new.next_match_id is not null then
    select * into target from public.matches where id = new.next_match_id for update;
    slot := new.next_slot;
  else
    nr := public.next_round(new.round);
    if nr is null then
      return null;
    end if;
    select * into target
    from public.matches
    where round = nr and match_number = (new.match_number + 1) / 2
    for update;
    slot := case when new.match_number % 2 = 1 then 1 else 2 end;
  end if;

  if not found then
    return null;
  end if;

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

-- Build the whole empty bracket from an ordered list of 2..64 players.
--   * Everyone plays in the first round: pairs are (1,2), (3,4) ...
--   * If a round has an ODD number of participants, the winner of its LAST match skips the next round
--     (a "bye"), so a bye only ever appears when it is unavoidable.
--   * Later rounds are created empty and fill in as results are entered.
-- Total matches is always players - 1.
create or replace function public.generate_bracket(p_player_ids uuid[])
returns int
language plpgsql
as $$
declare
  n            int := coalesce(array_length(p_player_ids, 1), 0);
  src_id       uuid[];
  src_is_match boolean[];
  nxt_id       uuid[];
  nxt_is_match boolean[];
  p            int;
  m            int;
  i            int;
  r            text;
  new_id       uuid;
  created      int := 0;
  s1 uuid; s2 uuid; m1 boolean; m2 boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if exists (select 1 from public.matches where round <> 'EXTRA') then
    raise exception 'Fixtures already exist. Reset the tournament before generating a new bracket.';
  end if;
  if n < 2 or n > 64 then
    raise exception 'A knockout bracket needs between 2 and 64 players (got %).', n;
  end if;
  if (select count(distinct x) from unnest(p_player_ids) as x) <> n then
    raise exception 'The same player appears more than once.';
  end if;
  if exists (
    select 1 from unnest(p_player_ids) as x where not exists (select 1 from public.players where id = x)
  ) then
    raise exception 'Unknown player in list.';
  end if;

  src_id := p_player_ids;
  src_is_match := array_fill(false, array[n]);

  while coalesce(array_length(src_id, 1), 0) >= 2 loop
    p := array_length(src_id, 1);
    r := public.stage_round(p);
    m := p / 2;
    nxt_id := '{}';
    nxt_is_match := '{}';

    for i in 1 .. m loop
      s1 := src_id[2 * i - 1];  m1 := src_is_match[2 * i - 1];
      s2 := src_id[2 * i];      m2 := src_is_match[2 * i];

      insert into public.matches (round, match_number, player1_id, player2_id)
      values (r, i, case when m1 then null else s1 end, case when m2 then null else s2 end)
      returning id into new_id;
      created := created + 1;

      if m1 then update public.matches set next_match_id = new_id, next_slot = 1 where id = s1; end if;
      if m2 then update public.matches set next_match_id = new_id, next_slot = 2 where id = s2; end if;

      nxt_id := nxt_id || new_id;
      nxt_is_match := nxt_is_match || true;
    end loop;

    -- odd count: the last participant is carried over to the next round (the bye)
    if p % 2 = 1 then
      nxt_id := nxt_id || src_id[p];
      nxt_is_match := nxt_is_match || src_is_match[p];
    end if;

    src_id := nxt_id;
    src_is_match := nxt_is_match;
  end loop;

  return created;
end;
$$;

-- Finish a bracket AROUND first-round fixtures that already exist (nothing you entered is changed or deleted).
--   * Players that are not in any fixture yet (p_unplaced_player_ids) are paired into NEW first-round fixtures.
--   * The remaining rounds and the "winner goes to" links are then built with the same bye rule as generate_bracket():
--     a bye only appears when a round has an odd number of participants.
--   * In AUTOMATIC mode the winners of already-played first-round matches are placed into their next-round slots.
-- Only works while the bracket consists of its first round alone.
create or replace function public.complete_bracket(p_unplaced_player_ids uuid[] default '{}')
returns int
language plpgsql
as $$
declare
  rounds       text[] := array['ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
  first_round  text;
  extra_n      int := coalesce(array_length(p_unplaced_player_ids, 1), 0);
  src_id       uuid[];
  src_is_match boolean[];
  nxt_id       uuid[];
  nxt_is_match boolean[];
  k            int;
  total_n      int;
  p            int;
  m            int;
  i            int;
  r            text;
  new_id       uuid;
  next_no      int;
  created      int := 0;
  s1 uuid; s2 uuid; m1 boolean; m2 boolean;
  w record;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select round into first_round
    from public.matches
   where round <> 'EXTRA'
   order by array_position(rounds, round)
   limit 1;
  if first_round is null then
    raise exception 'There are no fixtures yet. Use Generate bracket instead.';
  end if;
  if exists (select 1 from public.matches where round not in ('EXTRA', first_round)) then
    raise exception 'The bracket already has later rounds, so there is nothing to finish.';
  end if;

  if extra_n > 0 then
    if (select count(distinct x) from unnest(p_unplaced_player_ids) as x) <> extra_n then
      raise exception 'The same player appears more than once.';
    end if;
    if exists (select 1 from unnest(p_unplaced_player_ids) as x where not exists (select 1 from public.players where id = x)) then
      raise exception 'Unknown player in list.';
    end if;
    if exists (
      select 1 from public.matches mm
       where mm.round <> 'EXTRA'
         and (mm.player1_id = any (p_unplaced_player_ids) or mm.player2_id = any (p_unplaced_player_ids))
    ) then
      raise exception 'One of those players is already in a fixture.';
    end if;
  end if;

  select array_agg(id order by match_number) into src_id from public.matches where round = first_round;
  k := coalesce(array_length(src_id, 1), 0);
  src_is_match := array_fill(true, array[k]);

  -- the first round has to be consistent with how many players there are in total
  total_n := 2 * (k + extra_n / 2) + (extra_n % 2);
  if public.stage_round(total_n) <> first_round then
    raise exception 'The first round is "%", but % fixtures plus % unplaced players (% players in all) would make it "%". Add the missing players or fixtures first.',
      first_round, k, extra_n, total_n, public.stage_round(total_n);
  end if;

  -- new first-round fixtures for the players that are not in a fixture yet
  select coalesce(max(match_number), 0) into next_no from public.matches where round = first_round;
  for i in 1 .. extra_n / 2 loop
    next_no := next_no + 1;
    insert into public.matches (round, match_number, player1_id, player2_id)
    values (first_round, next_no, p_unplaced_player_ids[2 * i - 1], p_unplaced_player_ids[2 * i])
    returning id into new_id;
    created := created + 1;
    src_id := src_id || new_id;
    src_is_match := src_is_match || true;
  end loop;
  if extra_n % 2 = 1 then            -- an odd player out waits for the second round (a bye)
    src_id := src_id || p_unplaced_player_ids[extra_n];
    src_is_match := src_is_match || false;
  end if;

  if array_length(src_id, 1) < 2 then
    raise exception 'A bracket needs at least two matches or players to continue from.';
  end if;

  -- later rounds: identical rule to generate_bracket()
  while coalesce(array_length(src_id, 1), 0) >= 2 loop
    p := array_length(src_id, 1);
    r := public.stage_round(p);
    m := p / 2;
    nxt_id := '{}';
    nxt_is_match := '{}';

    for i in 1 .. m loop
      s1 := src_id[2 * i - 1];  m1 := src_is_match[2 * i - 1];
      s2 := src_id[2 * i];      m2 := src_is_match[2 * i];

      insert into public.matches (round, match_number, player1_id, player2_id)
      values (r, i, case when m1 then null else s1 end, case when m2 then null else s2 end)
      returning id into new_id;
      created := created + 1;

      if m1 then update public.matches set next_match_id = new_id, next_slot = 1 where id = s1; end if;
      if m2 then update public.matches set next_match_id = new_id, next_slot = 2 where id = s2; end if;

      nxt_id := nxt_id || new_id;
      nxt_is_match := nxt_is_match || true;
    end loop;

    if p % 2 = 1 then
      nxt_id := nxt_id || src_id[p];
      nxt_is_match := nxt_is_match || src_is_match[p];
    end if;

    src_id := nxt_id;
    src_is_match := nxt_is_match;
  end loop;

  -- automatic mode: put the winners of the first-round matches that are already played into their next-round slots
  if coalesce((select advancement_mode from public.tournament_settings where id = 1), 'MANUAL') = 'AUTO' then
    for w in
      select winner_id, next_match_id, next_slot
        from public.matches
       where round = first_round and winner_id is not null and next_match_id is not null
    loop
      if w.next_slot = 1 then
        update public.matches set player1_id = w.winner_id where id = w.next_match_id;
      else
        update public.matches set player2_id = w.winner_id where id = w.next_match_id;
      end if;
    end loop;
  end if;

  return created;
end;
$$;

-- Add one extra match between any two players (rematches, second chances ...). Unlimited; numbered automatically.
create or replace function public.create_extra_match(
  p_player1_id uuid,
  p_player2_id uuid,
  p_scheduled_at timestamptz default null
)
returns public.matches
language plpgsql
as $$
declare
  m public.matches;
  next_no int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if p_player1_id is null or p_player2_id is null then
    raise exception 'Choose both players.';
  end if;
  if p_player1_id = p_player2_id then
    raise exception 'A player cannot play themselves.';
  end if;
  if (select count(*) from public.players where id in (p_player1_id, p_player2_id)) <> 2 then
    raise exception 'Unknown player.';
  end if;

  select coalesce(max(match_number), 0) + 1 into next_no from public.matches where round = 'EXTRA';

  insert into public.matches (round, match_number, player1_id, player2_id, scheduled_at)
  values ('EXTRA', next_no, p_player1_id, p_player2_id, p_scheduled_at)
  returning * into m;

  return m;
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
revoke execute on function public.create_extra_match(uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.complete_bracket(uuid[])                from public, anon;
grant  execute on function public.submit_match_result(uuid, int, int) to authenticated;
grant  execute on function public.generate_bracket(uuid[])           to authenticated;
grant  execute on function public.reset_tournament()                 to authenticated;
grant  execute on function public.create_extra_match(uuid, uuid, timestamptz) to authenticated;
grant  execute on function public.complete_bracket(uuid[])                to authenticated;

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
