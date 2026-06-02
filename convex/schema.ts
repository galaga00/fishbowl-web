import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const gamePhase = v.union(
  v.literal("setup"),
  v.literal("lobby"),
  v.literal("ready"),
  v.literal("playing"),
  v.literal("paused"),
  v.literal("finished")
);

const teamAssignmentMode = v.union(v.literal("auto"), v.literal("choose"));
const promptMode = v.union(v.literal("free"), v.literal("category"), v.literal("deck"));
const playMode = v.union(v.literal("multi_device"), v.literal("pass_and_play"));
const promptStatus = v.union(v.literal("available"), v.literal("active"), v.literal("correct"));
const gameAction = v.union(v.literal("correct"), v.literal("skip"), v.literal("end_turn"));

export default defineSchema({
  games: defineTable({
    code: v.string(),
    host_player_id: v.union(v.id("players"), v.null()),
    phase: gamePhase,
    current_team_id: v.union(v.id("teams"), v.null()),
    active_player_id: v.union(v.id("players"), v.null()),
    current_prompt_id: v.union(v.id("prompts"), v.null()),
    turn_number: v.number(),
    round_number: v.number(),
    turn_duration_seconds: v.number(),
    prompts_per_player: v.number(),
    cards_dealt_per_player: v.number(),
    cards_kept_per_player: v.number(),
    pass_play_card_count: v.number(),
    expected_players: v.union(v.number(), v.null()),
    team_assignment_mode: teamAssignmentMode,
    prompt_mode: promptMode,
    prompt_categories: v.array(v.string()),
    play_mode: playMode,
    paused_at: v.union(v.string(), v.null()),
    created_at: v.string()
  }).index("by_code", ["code"]),

  teams: defineTable({
    game_id: v.id("games"),
    name: v.string(),
    score: v.number(),
    sort_order: v.number(),
    created_at: v.string()
  }).index("by_game", ["game_id"]),

  players: defineTable({
    game_id: v.id("games"),
    name: v.string(),
    is_host: v.boolean(),
    team_id: v.union(v.id("teams"), v.null()),
    has_submitted: v.boolean(),
    created_at: v.string()
  }).index("by_game", ["game_id"]),

  prompts: defineTable({
    game_id: v.id("games"),
    player_id: v.id("players"),
    text: v.string(),
    category: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    status: promptStatus,
    deck_order: v.union(v.number(), v.null()),
    created_at: v.string()
  })
    .index("by_game", ["game_id"])
    .index("by_game_status", ["game_id", "status"]),

  draft_cards: defineTable({
    game_id: v.id("games"),
    player_id: v.id("players"),
    card_id: v.string(),
    title: v.string(),
    description: v.string(),
    selected: v.boolean(),
    sort_order: v.number(),
    created_at: v.string()
  })
    .index("by_game", ["game_id"])
    .index("by_game_player", ["game_id", "player_id"]),

  turns: defineTable({
    game_id: v.id("games"),
    team_id: v.id("teams"),
    player_id: v.id("players"),
    started_at: v.string(),
    ended_at: v.union(v.string(), v.null()),
    correct_count: v.number(),
    skip_count: v.number()
  }).index("by_game", ["game_id"]),

  game_events: defineTable({
    game_id: v.id("games"),
    action: gameAction,
    payload: v.any(),
    undone_at: v.union(v.string(), v.null()),
    created_at: v.string()
  }).index("by_game", ["game_id"]),

  analytics_events: defineTable({
    event_name: v.string(),
    game_id: v.union(v.string(), v.null()),
    player_id: v.union(v.string(), v.null()),
    path: v.union(v.string(), v.null()),
    referrer: v.union(v.string(), v.null()),
    user_agent: v.union(v.string(), v.null()),
    device_type: v.union(v.string(), v.null()),
    ip_hash: v.union(v.string(), v.null()),
    country: v.union(v.string(), v.null()),
    region: v.union(v.string(), v.null()),
    city: v.union(v.string(), v.null()),
    play_mode: v.union(v.string(), v.null()),
    prompt_mode: v.union(v.string(), v.null()),
    phase: v.union(v.string(), v.null()),
    player_count: v.union(v.number(), v.null()),
    team_count: v.union(v.number(), v.null()),
    prompt_count: v.union(v.number(), v.null()),
    metadata: v.any(),
    created_at: v.string()
  })
    .index("by_created_at", ["created_at"])
    .index("by_game", ["game_id"])
    .index("by_event_name", ["event_name"])
});
