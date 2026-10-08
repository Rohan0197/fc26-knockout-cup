-- =============================================================================
--  MIGRATION 001: allow 64-player brackets (Round of 64 and Round of 32)
--  Only needed if you ran an OLDER supabase/schema.sql. New setups already include this.
--  Run once in Supabase -> SQL Editor. Safe to re-run. Does not touch players or results.
-- =============================================================================

alter table public.matches drop constraint if exists matches_round_check;
alter table public.matches add constraint matches_round_check
  check (round in ('ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'));

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

-- The execute permissions on generate_bracket come from schema.sql section 7; CREATE OR REPLACE keeps them.
