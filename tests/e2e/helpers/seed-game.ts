import { getNextTurnAssignment } from "../../../lib/game-utils";
import type { DraftCard, Game, GameEvent, GameSnapshot, Player, Prompt, Team, Turn } from "../../../lib/types";
import { createE2ESupabaseClient } from "./supabase-cleanup";

export type SeededTurnGame = {
  gameId: string;
  hostPlayerId: string;
  playerIdsByName: Record<string, string>;
};

type SeedReadyPassAndPlayOptions = {
  promptCount?: number;
  teamPlayers?: string[][];
  turnDurationSeconds?: 30 | 60;
};

export function createJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export async function insertSingle<T>(query: PromiseLike<{ data: T | null; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error("E2E seed insert did not return data.");
  return data;
}

export async function seedReadyPassAndPlayGame({
  promptCount = 10,
  teamPlayers = [
    ["Austin", "Briar"],
    ["Casey", "Drew"]
  ],
  turnDurationSeconds = 60
}: SeedReadyPassAndPlayOptions = {}): Promise<SeededTurnGame> {
  const supabase = createE2ESupabaseClient();
  const flatPlayers = teamPlayers.flat();
  const hostName = flatPlayers[0] ?? "Austin";
  const game = await insertSingle<{ id: string }>(
    supabase
      .from("games")
      .insert({
        code: createJoinCode(),
        phase: "setup",
        prompts_per_player: 1,
        turn_duration_seconds: turnDurationSeconds,
        cards_dealt_per_player: 1,
        cards_kept_per_player: 1,
        pass_play_card_count: Math.max(10, promptCount),
        expected_players: flatPlayers.length,
        team_assignment_mode: "auto",
        prompt_mode: "deck",
        prompt_categories: ["mixed"],
        play_mode: "pass_and_play",
        paused_at: null
      })
      .select("id")
      .single()
  );

  const teams = await insertSingle<Array<{ id: string; sort_order: number }>>(
    supabase
      .from("teams")
      .insert(teamPlayers.map((_, sort_order) => ({ game_id: game.id, name: `Team ${sort_order + 1}`, sort_order })))
      .select("id, sort_order")
      .order("sort_order")
  );

  const baseCreatedAt = Date.now() - flatPlayers.length * 1_000;
  const playerRows = teamPlayers.flatMap((players, teamIndex) =>
    players.map((name, playerIndex) => {
      const flatIndex = teamPlayers.slice(0, teamIndex).reduce((count, team) => count + team.length, 0) + playerIndex;
      return {
        game_id: game.id,
        name,
        is_host: name === hostName,
        team_id: teams[teamIndex]?.id ?? null,
        has_submitted: true,
        created_at: new Date(baseCreatedAt + flatIndex * 1_000).toISOString()
      };
    })
  );

  const players = await insertSingle<Array<{ id: string; name: string }>>(
    supabase.from("players").insert(playerRows).select("id, name")
  );

  const host = players.find((player) => player.name === hostName);
  if (!host) throw new Error("E2E seed did not create a host player.");

  const prompts = await insertSingle<Array<{ id: string; deck_order: number }>>(
    supabase
      .from("prompts")
      .insert(
        Array.from({ length: promptCount }, (_, index) => `Prompt ${index + 1}`).map((text, index) => ({
          game_id: game.id,
          player_id: host.id,
          text,
          category: "E2E",
          description: `Seeded ${text}`,
          status: index === 0 ? "active" : "available",
          deck_order: index
        }))
      )
      .select("id, deck_order")
      .order("deck_order")
  );

  const firstPrompt = prompts.find((prompt) => prompt.deck_order === 0);
  const firstTeam = teams[0];
  if (!firstPrompt || !firstTeam) throw new Error("E2E seed did not create first prompt/team.");

  const { error: updateError } = await supabase
    .from("games")
    .update({
      phase: "ready",
      host_player_id: host.id,
      active_player_id: host.id,
      current_team_id: firstTeam.id,
      current_prompt_id: firstPrompt.id,
      turn_number: 1,
      round_number: 1
    })
    .eq("id", game.id);

  if (updateError) throw updateError;

  return {
    gameId: game.id,
    hostPlayerId: host.id,
    playerIdsByName: Object.fromEntries(players.map((player) => [player.name, player.id]))
  };
}

export async function seedPlayingPassAndPlayGame(options: SeedReadyPassAndPlayOptions = {}): Promise<SeededTurnGame> {
  const seededGame = await seedReadyPassAndPlayGame(options);
  const supabase = createE2ESupabaseClient();
  const snapshot = await loadSeededSnapshot(seededGame.gameId);

  if (!snapshot.game.current_team_id || !snapshot.game.active_player_id) {
    throw new Error("E2E seed did not create a playable turn assignment.");
  }

  await insertSingle<{ id: string }>(
    supabase
      .from("turns")
      .insert({
        game_id: seededGame.gameId,
        team_id: snapshot.game.current_team_id,
        player_id: snapshot.game.active_player_id
      })
      .select("id")
      .single()
  );

  const { error } = await supabase.from("games").update({ phase: "playing" }).eq("id", seededGame.gameId);
  if (error) throw error;

  return seededGame;
}

export async function getActivePlayerName(gameId: string) {
  const supabase = createE2ESupabaseClient();
  const game = await insertSingle<{ active_player_id: string | null }>(
    supabase.from("games").select("active_player_id").eq("id", gameId).single()
  );
  if (!game.active_player_id) return null;

  const player = await insertSingle<{ name: string }>(
    supabase.from("players").select("name").eq("id", game.active_player_id).single()
  );
  return player.name;
}

export async function loadSeededSnapshot(gameId: string): Promise<GameSnapshot> {
  const supabase = createE2ESupabaseClient();
  const [gameResult, playerResult, teamResult, promptResult, turnResult, eventResult] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single<Game>(),
    supabase.from("players").select("*").eq("game_id", gameId).order("created_at"),
    supabase.from("teams").select("*").eq("game_id", gameId).order("sort_order"),
    supabase.from("prompts").select("*").eq("game_id", gameId).order("deck_order"),
    supabase.from("turns").select("*").eq("game_id", gameId).is("ended_at", null).maybeSingle<Turn>(),
    supabase.from("game_events").select("*").eq("game_id", gameId).is("undone_at", null).maybeSingle<GameEvent>()
  ]);

  const error = [gameResult, playerResult, teamResult, promptResult, turnResult, eventResult].find((result) => result.error)?.error;
  if (error) throw error;
  if (!gameResult.data) throw new Error("E2E seed could not load game.");

  return {
    game: gameResult.data,
    players: playerResult.data as Player[],
    teams: teamResult.data as Team[],
    prompts: promptResult.data as Prompt[],
    draftCards: [] as DraftCard[],
    activeTurn: turnResult.data,
    latestUndoableEvent: eventResult.data
  };
}

export async function advanceTurnWithAssignmentHelper(gameId: string) {
  const supabase = createE2ESupabaseClient();
  const snapshot = await loadSeededSnapshot(gameId);
  const nextAssignment = getNextTurnAssignment(snapshot);
  if (!nextAssignment || !snapshot.game.current_prompt_id) throw new Error("Seeded game was not ready to advance.");

  const { error } = await supabase
    .from("games")
    .update({
      phase: "ready",
      active_player_id: nextAssignment.player.id,
      current_team_id: nextAssignment.team.id,
      turn_number: snapshot.game.turn_number + 1
    })
    .eq("id", gameId);
  if (error) throw error;
}
