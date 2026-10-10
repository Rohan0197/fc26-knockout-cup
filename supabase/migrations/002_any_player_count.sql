-- =============================================================================
--  MIGRATION 002: brackets for ANY number of players (2-64), everyone plays round one
--  Run once in Supabase -> SQL Editor if you set the database up from an older schema.sql.
--  Safe to re-run. Does not touch players, results or standings.
--  (It also includes everything from migration 001, so you do not need to run 001 first.)
-- =============================================================================

-- 1. allow the Round of 64 / Round of 32 round names
alter table public.matches drop constraint if exists matches_round_check;
alter table public.matches add constraint matches_round_check
  check (round in ('ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'));

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

-- 5. new functions
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
  if exists (select 1 from public.matches) then
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

-- (execute permissions on generate_bracket are kept by CREATE OR REPLACE; see schema.sql section 7)
