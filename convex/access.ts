import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type ReadCtx = QueryCtx | MutationCtx;

export async function hashSessionToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("A valid player session is required. Rejoin with your recovery code.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function findViewer(ctx: ReadCtx, gameId: Id<"games">, token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = await hashSessionToken(token);
  return ctx.db.query("players").withIndex("by_game_session", (q) => q.eq("game_id", gameId).eq("session_token_hash", hash)).unique();
}

export async function requirePlayer(ctx: ReadCtx, gameId: Id<"games">, token: string) {
  const player = await findViewer(ctx, gameId, token);
  if (!player) throw new Error("Your session could not be verified. Rejoin with your recovery code.");
  return player;
}

export async function requireHost(ctx: ReadCtx, gameId: Id<"games">, token: string) {
  const player = await requirePlayer(ctx, gameId, token);
  const game = await ctx.db.get(gameId);
  if (!player.is_host || game?.host_player_id !== player._id) throw new Error("Only the host can do that.");
  return player;
}

export async function requireController(ctx: ReadCtx, gameId: Id<"games">, token: string) {
  const player = await requirePlayer(ctx, gameId, token);
  const game = await ctx.db.get(gameId);
  if (game?.active_player_id !== player._id && !(game?.play_mode === "pass_and_play" && game.host_player_id === player._id)) {
    throw new Error("Only the current clue giver can control this turn.");
  }
  return player;
}

export function requireOwner(key: string) {
  const expected = process.env.OWNER_ANALYTICS_KEY;
  if (!expected || key.length !== expected.length) throw new Error("Unauthorized.");
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= key.charCodeAt(index) ^ expected.charCodeAt(index);
  if (difference !== 0) throw new Error("Unauthorized.");
}
