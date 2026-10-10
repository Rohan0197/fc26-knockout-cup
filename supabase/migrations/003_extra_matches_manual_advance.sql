-- =============================================================================
--  MIGRATION 003: extra matches + admin-controlled advancement (includes 001 and 002)
--  Run once in Supabase -> SQL Editor if you set the database up from an older schema.sql.
--  Safe to re-run. Does not change players, results, scores or standings.
--  (It also includes everything from migration 001, so you do not need to run 001 first.)
-- =============================================================================

-- 1. allow the Round of 64 / Round of 32 round names
alter table public.matches drop constraint if exists matches_round_check;
alter table public.matches add constraint matches_round_check
  check (round in ('ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'EXTRA'));

-- 2. explicit "winner goes to" link on every match
alter table public.matches add column if not exists next_match_id uuid references public.matches (id);
alter table public.matches add column if not exists next_slot int;
alter table public.matches drop constraint if exists matches_next_slot_check;
alter table public.matches add constraint matches_next_slot_check check (next_slot in (1, 2));
alter table public.matches drop constraint if exists next_link_is_complete;
alter table public.matches add constraint next_link_is_complete check ((next_match_id is null) = (next_slot is null));
alter table public.matches drop constraint if exists next_link_not_self;
alter table public.matches add constraint next_link_not_self check (next_match_id is distinct from id);

-- 3. next_round(): include the two new rounds
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

-- 4. link the matches that already exist (classic rule: match N feeds match ceil(N/2) of the next round)
update public.matches m
   set next_match_id = t.id,
       next_slot     = case when m.match_number % 2 = 1 then 1 else 2 end
  from public.matches t
 where m.next_match_id is null
   and public.next_round(m.round) is not null
   and t.round = public.next_round(m.round)
   and t.match_number = (m.match_number + 1) / 2;

-- 5. admin-controlled advancement setting (AUTO: winners are placed automatically; MANUAL: the admin places players)
-- IMPORTANT: a tournament that is already running keeps behaving exactly as before (winners advance automatically).
-- The existing settings row gets 'AUTO'; you can switch to MANUAL in Admin -> Settings whenever you like.
alter table public.tournament_settings add column if not exists advancement_mode text not null default 'AUTO';
alter table public.tournament_settings alter column advancement_mode set default 'MANUAL'; -- default for brand-new installs only
alter table public.tournament_settings drop constraint if exists tournament_settings_advancement_mode_check;
alter table public.tournament_settings add constraint tournament_settings_advancement_mode_check
  check (advancement_mode in ('AUTO', 'MANUAL'));

-- 6. functions
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

-- 6b. finish a bracket around fixtures that already exist (keeps every existing fixture and result)
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

-- 7. permissions for the new function
revoke execute on function public.create_extra_match(uuid, uuid, timestamptz) from public, anon;
grant  execute on function public.create_extra_match(uuid, uuid, timestamptz) to authenticated;
revoke execute on function public.complete_bracket(uuid[]) from public, anon;
grant  execute on function public.complete_bracket(uuid[]) to authenticated;
-- (CREATE OR REPLACE keeps the existing permissions on the other functions)
