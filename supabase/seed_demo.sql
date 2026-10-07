-- =============================================================================
--  DEMO / DEVELOPMENT DATA ONLY  -  do NOT run this on your real tournament.
--  Loads 8 sample players and a Quarter-Final bracket with a few results so you can
--  see the site populated. Run supabase/schema.sql first.
--
--  To remove it again:   select public.reset_tournament();   (as admin)  and
--                        delete from public.players;
--  (or simply use the admin panel: Bracket -> Reset tournament, then delete players)
-- =============================================================================

insert into public.players (id, name, short_name, club) values
  ('00000000-0000-0000-0000-000000000001', 'Rohan Dongre', 'ROHAN', 'Real Madrid'),
  ('00000000-0000-0000-0000-000000000002', 'Player 02',    'P02',   'Manchester City'),
  ('00000000-0000-0000-0000-000000000003', 'Player 03',    'P03',   'Bayern Munich'),
  ('00000000-0000-0000-0000-000000000004', 'Player 04',    'P04',   'Arsenal'),
  ('00000000-0000-0000-0000-000000000005', 'Player 05',    'P05',   'Barcelona'),
  ('00000000-0000-0000-0000-000000000006', 'Player 06',    'P06',   'Inter'),
  ('00000000-0000-0000-0000-000000000007', 'Player 07',    'P07',   'PSG'),
  ('00000000-0000-0000-0000-000000000008', 'Player 08',    'P08',   'Liverpool')
on conflict do nothing;

-- Empty bracket for 8 players (4 quarter-finals, 2 semi-finals, 1 final).
-- generate_bracket() checks is_admin(); in the SQL editor you are the postgres role, so build
-- the rows directly instead:
insert into public.matches (round, match_number, player1_id, player2_id, scheduled_at) values
  ('QUARTER_FINAL', 1, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', now() + interval '1 day'),
  ('QUARTER_FINAL', 2, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', now() + interval '1 day 1 hour'),
  ('QUARTER_FINAL', 3, '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', now() + interval '2 days'),
  ('QUARTER_FINAL', 4, '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008', now() + interval '2 days 1 hour'),
  ('SEMI_FINAL',    1, null, null, now() + interval '4 days'),
  ('SEMI_FINAL',    2, null, null, now() + interval '4 days 1 hour'),
  ('FINAL',         1, null, null, now() + interval '6 days')
on conflict (round, match_number) do nothing;

-- Results: the triggers derive the winner and advance them to the semi-finals.
update public.matches set player1_score = 3, player2_score = 1, status = 'COMPLETED'
 where round = 'QUARTER_FINAL' and match_number = 1;
update public.matches set player1_score = 1, player2_score = 2, status = 'COMPLETED'
 where round = 'QUARTER_FINAL' and match_number = 2;
