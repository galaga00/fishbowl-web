export type GamePhase = "setup" | "lobby" | "ready" | "playing" | "paused" | "finished";
export type TeamAssignmentMode = "auto" | "choose";
export type PromptMode = "free" | "category" | "deck";
export type PlayMode = "multi_device" | "pass_and_play";

export type Game = {
  id: string;
  code: string;
  host_player_id: string | null;
  phase: GamePhase;
  current_team_id: string | null;
  active_player_id: string | null;
  current_prompt_id: string | null;
  turn_number: number;
  round_number: number;
  turn_duration_seconds: number;
  prompts_per_player: number;
  cards_dealt_per_player: number;
  cards_kept_per_player: number;
  pass_play_card_count: number;
  expected_players: number | null;
  team_assignment_mode: TeamAssignmentMode;
  prompt_mode: PromptMode;
  prompt_categories: string[] | null;
  play_mode: PlayMode;
  paused_at: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  game_id: string;
  name: string;
  is_host: boolean;
  team_id: string | null;
  has_submitted: boolean;
  created_at: string;
};

export type Team = {
  id: string;
  game_id: string;
  name: string;
  score: number;
  sort_order: number;
};

export type Prompt = {
  id: string;
  game_id: string;
  player_id: string;
  text: string;
  category: string | null;
  description: string | null;
  status: "available" | "active" | "correct";
  deck_order: number | null;
  created_at: string;
};

export type DraftCard = {
  id: string;
  game_id: string;
  player_id: string;
  card_id: string;
  title: string;
  description: string;
  selected: boolean;
  sort_order: number;
  created_at: string;
};

export type Turn = {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string;
  started_at: string;
  ended_at: string | null;
  correct_count: number;
  skip_count: number;
};

export type GameEvent = {
  id: string;
  game_id: string;
  action: "correct" | "skip" | "end_turn";
  payload: {
    game: Pick<Game, "phase" | "current_team_id" | "active_player_id" | "current_prompt_id" | "turn_number" | "round_number" | "paused_at">;
    teams: Array<Pick<Team, "id" | "score">>;
    prompts: Array<Pick<Prompt, "id" | "status" | "deck_order">>;
    activeTurn: Pick<Turn, "id" | "ended_at" | "correct_count" | "skip_count"> | null;
  };
  undone_at: string | null;
  created_at: string;
};

export type AnalyticsEvent = {
  id: string;
  event_name: string;
  game_id: string | null;
  player_id: string | null;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  device_type: string | null;
  play_mode: string | null;
  prompt_mode: string | null;
  phase: string | null;
  player_count: number | null;
  team_count: number | null;
  prompt_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type GameSnapshot = {
  game: Game;
  players: Player[];
  teams: Team[];
  prompts: Prompt[];
  draftCards: DraftCard[];
  activeTurn: Turn | null;
  latestUndoableEvent: GameEvent | null;
};
