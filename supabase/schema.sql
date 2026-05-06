create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_player_id uuid,
  phase text not null default 'setup' check (phase in ('setup', 'lobby', 'ready', 'playing', 'paused', 'finished')),
  current_team_id uuid,
  active_player_id uuid,
  current_prompt_id uuid,
  turn_number integer not null default 0,
  round_number integer not null default 1,
  turn_duration_seconds integer not null default 60,
  prompts_per_player integer not null default 3,
  cards_dealt_per_player integer not null default 10,
  cards_kept_per_player integer not null default 5,
  pass_play_card_count integer not null default 45,
  expected_players integer,
  team_assignment_mode text not null default 'auto' check (team_assignment_mode in ('auto', 'choose')),
  prompt_mode text not null default 'free' check (prompt_mode in ('free', 'category', 'deck')),
  prompt_categories text[] not null default array['mixed'],
  play_mode text not null default 'multi_device' check (play_mode in ('multi_device', 'pass_and_play')),
  paused_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  score integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  is_host boolean not null default false,
  team_id uuid references public.teams(id) on delete set null,
  has_submitted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  text text not null,
  category text,
  description text,
  status text not null default 'available' check (status in ('available', 'active', 'correct')),
  deck_order integer,
  created_at timestamptz not null default now()
);

create table if not exists public.draft_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  card_id text not null,
  title text not null,
  description text not null,
  selected boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  correct_count integer not null default 0,
  skip_count integer not null default 0
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  action text not null check (action in ('correct', 'skip', 'end_turn')),
  payload jsonb not null,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  game_id uuid references public.games(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  path text,
  referrer text,
  user_agent text,
  device_type text,
  play_mode text,
  prompt_mode text,
  phase text,
  player_count integer,
  team_count integer,
  prompt_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'games_host_player_id_fkey') then
    alter table public.games add constraint games_host_player_id_fkey foreign key (host_player_id) references public.players(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_current_team_id_fkey') then
    alter table public.games add constraint games_current_team_id_fkey foreign key (current_team_id) references public.teams(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_active_player_id_fkey') then
    alter table public.games add constraint games_active_player_id_fkey foreign key (active_player_id) references public.players(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_current_prompt_id_fkey') then
    alter table public.games add constraint games_current_prompt_id_fkey foreign key (current_prompt_id) references public.prompts(id) on delete set null;
  end if;
end $$;

create index if not exists games_code_idx on public.games(code);
create index if not exists players_game_id_idx on public.players(game_id);
create index if not exists teams_game_id_idx on public.teams(game_id);
create index if not exists prompts_game_id_status_idx on public.prompts(game_id, status);
create index if not exists draft_cards_game_player_idx on public.draft_cards(game_id, player_id);
create index if not exists turns_game_id_active_idx on public.turns(game_id, ended_at);
create index if not exists game_events_game_id_undo_idx on public.game_events(game_id, undone_at, created_at desc);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_game_id_idx on public.analytics_events(game_id, created_at desc);
create index if not exists analytics_events_event_name_idx on public.analytics_events(event_name, created_at desc);

alter table public.games add column if not exists prompts_per_player integer not null default 3;
alter table public.games add column if not exists turn_duration_seconds integer not null default 60;
alter table public.games add column if not exists cards_dealt_per_player integer not null default 10;
alter table public.games add column if not exists cards_kept_per_player integer not null default 5;
alter table public.games add column if not exists pass_play_card_count integer not null default 45;
alter table public.games add column if not exists expected_players integer;
alter table public.games add column if not exists team_assignment_mode text not null default 'auto';
alter table public.games add column if not exists prompt_mode text not null default 'free';
alter table public.games add column if not exists prompt_categories text[] not null default array['mixed'];
alter table public.games add column if not exists play_mode text not null default 'multi_device';
alter table public.games add column if not exists paused_at timestamptz;
alter table public.games alter column phase set default 'setup';
alter table public.prompts add column if not exists category text;
alter table public.prompts add column if not exists description text;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'games_phase_check') then
    alter table public.games drop constraint games_phase_check;
  end if;
  alter table public.games add constraint games_phase_check check (phase in ('setup', 'lobby', 'ready', 'playing', 'paused', 'finished'));
  if exists (select 1 from pg_constraint where conname = 'games_prompts_per_player_check') then
    alter table public.games drop constraint games_prompts_per_player_check;
  end if;
  alter table public.games add constraint games_prompts_per_player_check check (prompts_per_player between 1 and 20);
  if exists (select 1 from pg_constraint where conname = 'games_turn_duration_seconds_check') then
    alter table public.games drop constraint games_turn_duration_seconds_check;
  end if;
  alter table public.games add constraint games_turn_duration_seconds_check check (turn_duration_seconds in (30, 60));
  if exists (select 1 from pg_constraint where conname = 'games_cards_dealt_per_player_check') then
    alter table public.games drop constraint games_cards_dealt_per_player_check;
  end if;
  alter table public.games add constraint games_cards_dealt_per_player_check check (cards_dealt_per_player between 1 and 20);
  if exists (select 1 from pg_constraint where conname = 'games_cards_kept_per_player_check') then
    alter table public.games drop constraint games_cards_kept_per_player_check;
  end if;
  alter table public.games add constraint games_cards_kept_per_player_check check (cards_kept_per_player between 1 and cards_dealt_per_player);
  if exists (select 1 from pg_constraint where conname = 'games_pass_play_card_count_check') then
    alter table public.games drop constraint games_pass_play_card_count_check;
  end if;
  alter table public.games add constraint games_pass_play_card_count_check check (pass_play_card_count between 10 and 80);
  if exists (select 1 from pg_constraint where conname = 'games_expected_players_check') then
    alter table public.games drop constraint games_expected_players_check;
  end if;
  alter table public.games add constraint games_expected_players_check check (expected_players is null or expected_players between 1 and 200);
  if exists (select 1 from pg_constraint where conname = 'games_team_assignment_mode_check') then
    alter table public.games drop constraint games_team_assignment_mode_check;
  end if;
  alter table public.games add constraint games_team_assignment_mode_check check (team_assignment_mode in ('auto', 'choose'));
  if exists (select 1 from pg_constraint where conname = 'games_prompt_mode_check') then
    alter table public.games drop constraint games_prompt_mode_check;
  end if;
  alter table public.games add constraint games_prompt_mode_check check (prompt_mode in ('free', 'category', 'deck'));
  if exists (select 1 from pg_constraint where conname = 'games_play_mode_check') then
    alter table public.games drop constraint games_play_mode_check;
  end if;
  alter table public.games add constraint games_play_mode_check check (play_mode in ('multi_device', 'pass_and_play'));
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games') then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players') then
    alter publication supabase_realtime add table public.players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams') then
    alter publication supabase_realtime add table public.teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prompts') then
    alter publication supabase_realtime add table public.prompts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_cards') then
    alter publication supabase_realtime add table public.draft_cards;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turns') then
    alter publication supabase_realtime add table public.turns;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_events') then
    alter publication supabase_realtime add table public.game_events;
  end if;
end $$;

-- MVP note: no login is required, so the browser uses the anon key directly.
-- Keep RLS disabled for fast local testing, or add policies before sharing broadly.
alter table public.games disable row level security;
alter table public.players disable row level security;
alter table public.teams disable row level security;
alter table public.prompts disable row level security;
alter table public.draft_cards disable row level security;
alter table public.turns disable row level security;
alter table public.game_events disable row level security;
alter table public.analytics_events disable row level security;
