import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { createE2EConvexClient, deleteTestGames } from "./helpers/convex-cleanup";
import { actionArgs, matchArgs, setupArgs } from "./helpers/game-args";
import { loadSeededSnapshot, seedPlayingPassAndPlayGame, seedReadyPassAndPlayGame, setActiveTurnStartedAt } from "./helpers/seed-game";

const token = () => randomBytes(32).toString("hex");
const ids: string[] = [];
test.afterEach(async () => { await deleteTestGames(ids); ids.length = 0; });

async function room() {
  const convex = createE2EConvexClient();
  const sessionToken = token();
  const result = await convex.mutation(api.game.createGame, { hostName: "Host", sessionToken });
  ids.push(result.game.id);
  return { ...result, sessionToken, convex };
}

test("owner functions fail closed without the owner credential", async ({ request }) => {
  const { game, convex } = await room();
  await expect(convex.query(api.analytics.ownerSnapshot, { ownerKey: "invalid-owner-key" })).rejects.toThrow("Unauthorized");
  await expect(convex.mutation(api.analytics.purgeAll, { ownerKey: "invalid-owner-key" })).rejects.toThrow("Unauthorized");
  expect((await request.post("/api/owner/purge", { data: { key: "invalid-owner-key" } })).status()).toBe(401);
  expect((await loadSeededSnapshot(game.id)).game.id).toBe(game.id);
});

test("sessions prevent host impersonation, cross-room changes, and duplicate joins", async () => {
  const { game, player: host, sessionToken, convex } = await room();
  await convex.mutation(api.game.saveGameSetup, setupArgs(game.id, sessionToken));
  const guestToken = token();
  const guest = await convex.mutation(api.game.joinGame, { code: game.code, playerName: "Guest", sessionToken: guestToken });
  const retry = await convex.mutation(api.game.joinGame, { code: game.code, playerName: "Guest again", sessionToken: guestToken });
  expect(retry.player.id).toBe(guest.player.id);
  const snapshot = await loadSeededSnapshot(game.id);
  expect(snapshot.players).toHaveLength(2);
  await expect(convex.mutation(api.game.startGame, matchArgs(snapshot, token()))).rejects.toThrow("session");
  await expect(convex.mutation(api.game.startGame, matchArgs(snapshot, guestToken))).rejects.toThrow("host");
  await expect(convex.mutation(api.game.updatePlayerName, { gameId: game.id, sessionToken: guestToken, playerId: host.id, name: "Stolen host" })).rejects.toThrow("yourself");
  const other = await room();
  await convex.mutation(api.game.saveGameSetup, setupArgs(other.game.id, other.sessionToken));
  const otherSnapshot = await loadSeededSnapshot(other.game.id);
  await expect(convex.mutation(api.game.assignPlayerToTeam, { gameId: game.id, sessionToken, playerId: guest.player.id, teamId: otherSnapshot.teams[0].id as Id<"teams"> })).rejects.toThrow("this room");
  const publicView = await convex.query(api.game.loadSnapshot, { gameId: game.id });
  expect(publicView!.players).toEqual([]);
  expect(publicView!.draftCards).toEqual([]);
  const guestView = await convex.query(api.game.loadSnapshot, { gameId: game.id, sessionToken: guestToken });
  expect(guestView!.draftCards).toHaveLength(4);
  expect(guestView!.draftCards.every((card) => card.player_id === guest.player.id)).toBe(true);
  expect(JSON.stringify(guestView)).not.toContain("session_token_hash");
  const hostCards = snapshot.draftCards.filter((card) => card.player_id === host.id);
  await expect(convex.mutation(api.game.setDraftCardSelected, { gameId: game.id, sessionToken: guestToken, playerId: host.id, draftCardId: hostCards[0].id as Id<"draft_cards">, selected: true })).rejects.toThrow("your own");
});

test("prompt text stays private and only the current clue giver controls a live turn", async () => {
  const { game, player: host, sessionToken, convex } = await room();
  await convex.mutation(api.game.saveGameSetup, { ...setupArgs(game.id, sessionToken), promptMode: "free" });
  const guestToken = token();
  const guest = await convex.mutation(api.game.joinGame, { code: game.code, playerName: "Guest", sessionToken: guestToken });
  await convex.mutation(api.game.submitPrompts, { gameId: game.id, sessionToken, playerId: host.id, prompts: ["Host secret"] });
  await convex.mutation(api.game.submitPrompts, { gameId: game.id, sessionToken: guestToken, playerId: guest.player.id, prompts: ["Guest secret"] });
  const hostView = await convex.query(api.game.loadSnapshot, { gameId: game.id, sessionToken });
  expect(hostView!.prompts.map((p) => p.text)).toContain("Host secret");
  expect(hostView!.prompts.map((p) => p.text)).not.toContain("Guest secret");
  await convex.mutation(api.game.startGame, matchArgs(hostView!, sessionToken));
  const ready = await loadSeededSnapshot(game.id);
  const activeToken = ready.game.active_player_id === host.id ? sessionToken : guestToken;
  const otherToken = ready.game.active_player_id === host.id ? guestToken : sessionToken;
  await expect(convex.mutation(api.game.startTurn, { ...matchArgs(ready, otherToken), expectedTurnNumber: ready.game.turn_number })).rejects.toThrow("clue giver");
  const startArgs = { ...matchArgs(ready, activeToken), expectedTurnNumber: ready.game.turn_number };
  await Promise.all([convex.mutation(api.game.startTurn, startArgs), convex.mutation(api.game.startTurn, startArgs)]);
  const live = await loadSeededSnapshot(game.id);
  const waiting = await convex.query(api.game.loadSnapshot, { gameId: game.id, sessionToken: otherToken });
  expect(waiting!.prompts.every((p) => p.text === "")).toBe(true);
  await expect(convex.mutation(api.game.markCorrect, actionArgs(live, otherToken))).rejects.toThrow("clue giver");
  await expect(convex.mutation(api.game.submitPrompts, { gameId: game.id, sessionToken, playerId: host.id, prompts: ["Late prompt"] })).rejects.toThrow("no longer available");
  await expect(convex.mutation(api.game.joinGame, { code: game.code, playerName: "Late player", sessionToken: token() })).rejects.toThrow("no longer available");
  await setActiveTurnStartedAt(game.id, new Date(Date.now() - 61_000).toISOString());
  const expired = await loadSeededSnapshot(game.id);
  await convex.mutation(api.game.endTurn, { ...matchArgs(expired, otherToken), expectedTurnId: expired.activeTurn!.id as Id<"turns">, expiredOnly: true });
  expect((await loadSeededSnapshot(game.id)).game.phase).toBe("ready");
});

test("server rejects scoring after the deadline and ignores a delayed end from an earlier turn", async () => {
  const seeded = await seedPlayingPassAndPlayGame({ promptCount: 3, turnDurationSeconds: 30 });
  ids.push(seeded.gameId);
  const convex = createE2EConvexClient();
  await setActiveTurnStartedAt(seeded.gameId, new Date(Date.now() - 31_000).toISOString());
  const expired = await loadSeededSnapshot(seeded.gameId);
  await convex.mutation(api.game.markCorrect, actionArgs(expired, seeded.sessionToken));
  const ready = await loadSeededSnapshot(seeded.gameId);
  expect(ready.teams.reduce((sum, team) => sum + team.score, 0)).toBe(0);
  expect(ready.game.phase).toBe("ready");
  await convex.mutation(api.game.startTurn, { ...matchArgs(ready, seeded.sessionToken), expectedTurnNumber: ready.game.turn_number });
  await convex.mutation(api.game.endTurn, { ...matchArgs(expired, seeded.sessionToken), expectedTurnId: expired.activeTurn!.id as Id<"turns">, expiredOnly: false });
  expect((await loadSeededSnapshot(seeded.gameId)).game.phase).toBe("playing");
});

test("oversized decks fail before creating a lobby and leave setup recoverable", async () => {
  const { game, sessionToken, convex } = await room();
  const setup = { ...setupArgs(game.id, sessionToken), playMode: "pass_and_play" as const, passPlayCardCount: 80, passPlayCategories: ["internet_memes"] };
  await expect(convex.mutation(api.game.saveGameSetup, setup)).rejects.toThrow("44 unique cards");
  expect((await loadSeededSnapshot(game.id)).game.phase).toBe("setup");
  await convex.mutation(api.game.saveGameSetup, { ...setup, passPlayCardCount: 44 });
  expect((await loadSeededSnapshot(game.id)).prompts).toHaveLength(44);
});

test("fresh rematches avoid the previous bowl and invalidate stale actions and undo history", async () => {
  const { game, sessionToken, convex } = await room();
  await convex.mutation(api.game.saveGameSetup, { ...setupArgs(game.id, sessionToken), playMode: "pass_and_play" });
  const before = await loadSeededSnapshot(game.id);
  const previousTitles = new Set(before.prompts.map((p) => p.text));
  await convex.mutation(api.game.startGame, matchArgs(before, sessionToken));
  const ready = await loadSeededSnapshot(game.id);
  await convex.mutation(api.game.startTurn, { ...matchArgs(ready, sessionToken), expectedTurnNumber: ready.game.turn_number });
  const live = await loadSeededSnapshot(game.id);
  await convex.mutation(api.game.markCorrect, actionArgs(live, sessionToken));
  await convex.mutation(api.game.finishGame, matchArgs(live, sessionToken));
  await convex.mutation(api.game.resetToLobby, { ...matchArgs(live, sessionToken), freshCards: true });
  const rematch = await loadSeededSnapshot(game.id);
  expect(rematch.game.match_number).toBe(2);
  expect(rematch.prompts).toHaveLength(20);
  expect(rematch.prompts.every((p) => !previousTitles.has(p.text))).toBe(true);
  expect(rematch.latestUndoableEvent).toBeNull();
  expect(rematch.teams.map((team) => team.score)).toEqual([0, 0]);
  expect(rematch.players.map((player) => player.id)).toEqual(before.players.map((player) => player.id));
  await convex.mutation(api.game.startGame, matchArgs(rematch, sessionToken));
  await convex.mutation(api.game.finishGame, matchArgs(live, sessionToken));
  expect((await loadSeededSnapshot(game.id)).game.phase).toBe("ready");
});

test("undo restores one paused turn with remaining time", async () => {
  const seeded = await seedReadyPassAndPlayGame({ promptCount: 3 });
  ids.push(seeded.gameId);
  const convex = createE2EConvexClient();
  const ready = await loadSeededSnapshot(seeded.gameId);
  await convex.mutation(api.game.startTurn, { ...matchArgs(ready, seeded.sessionToken), expectedTurnNumber: 1 });
  const live = await loadSeededSnapshot(seeded.gameId);
  await convex.mutation(api.game.markCorrect, actionArgs(live, seeded.sessionToken));
  const after = await loadSeededSnapshot(seeded.gameId);
  await convex.mutation(api.game.undoLastAction, matchArgs(after, seeded.sessionToken));
  const restored = await loadSeededSnapshot(seeded.gameId);
  expect(restored.game.phase).toBe("paused");
  expect(restored.game.current_prompt_id).toBe(live.game.current_prompt_id);
  expect(restored.activeTurn?.correct_count).toBe(0);
  expect(restored.teams[0].score).toBe(0);
  expect(Date.parse(restored.game.paused_at!) - Date.parse(restored.activeTurn!.started_at)).toBeLessThan(10_000);
});
