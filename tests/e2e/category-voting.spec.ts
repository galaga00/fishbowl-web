import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import type { GameSnapshot } from "../../lib/types";
import { buildVotedBowl, chooseCategoryWinner, createCategoryBallots } from "../../lib/category-vote";
import { createE2EConvexClient, deleteTestGames } from "./helpers/convex-cleanup";
import { actionArgs, matchArgs, setupArgs } from "./helpers/game-args";
import { loadSeededSnapshot } from "./helpers/seed-game";

const ids: string[] = [];
const token = () => randomBytes(32).toString("hex");
test.afterEach(async () => { await deleteTestGames(ids); ids.length = 0; });

async function room(playerCount = 2, cards = 10, rounds = 3) {
  const convex = createE2EConvexClient();
  const sessionToken = token();
  const created = await convex.mutation(api.game.createGame, { hostName: "Host", sessionToken });
  ids.push(created.game.id);
  const gameId = created.game.id;
  const setup = { ...setupArgs(gameId, sessionToken), deckSelection: "vote" as const, voteCardCount: cards, voteCategoryCount: rounds };
  await convex.mutation(api.game.saveGameSetup, setup);
  const sessions = [{ id: created.player.id, sessionToken }];
  for (let i = 1; i < playerCount; i++) {
    const guestToken = token();
    const guest = await convex.mutation(api.game.joinGame, { code: created.game.code, sessionToken: guestToken, playerName: `Guest ${i}` });
    sessions.push({ id: guest.player.id, sessionToken: guestToken });
  }
  const snapshot = async (session = sessionToken) => (await convex.query(api.game.loadSnapshot, { gameId, sessionToken: session }))!;
  return { convex, gameId, sessions, sessionToken, setup, snapshot, code: created.game.code };
}
function ballotArgs(snapshot: GameSnapshot, sessionToken: string) {
  return { ...matchArgs(snapshot, sessionToken), voteId: snapshot.categoryVote!.id!, expectedRound: snapshot.categoryVote!.round };
}

test("category voting protects ballots, survives concurrent votes, completes three rounds and rematches", async () => {
  const { convex, gameId, sessions, sessionToken, setup, snapshot, code } = await room(6);
  const waiting = await snapshot();
  expect(waiting.draftCards).toEqual([]);
  expect(waiting.categoryVote?.status).toBe("waiting");
  await expect(convex.mutation(api.game.startGame, matchArgs(waiting, sessionToken))).rejects.toThrow("voting");
  await expect(convex.mutation(api.game.startCategoryVoting, matchArgs(waiting, sessions[1].sessionToken))).rejects.toThrow("host");
  await convex.mutation(api.game.startCategoryVoting, matchArgs(waiting, sessionToken));
  const first = await snapshot();
  await convex.mutation(api.game.startCategoryVoting, matchArgs(first, sessionToken));
  expect((await snapshot()).categoryVote).toEqual(first.categoryVote);
  await expect(convex.mutation(api.game.saveGameSetup, setup)).rejects.toThrow("Finish category voting");
  await expect(convex.mutation(api.game.joinGame, { code, sessionToken: token(), playerName: "Late" })).rejects.toThrow("underway");
  const rejoin = await convex.mutation(api.game.joinGame, { code, sessionToken: sessions[1].sessionToken, playerName: "Same guest" });
  expect(rejoin.player.id).toBe(sessions[1].id);
  expect(rejoin.game).not.toHaveProperty("category_vote");
  await expect(convex.mutation(api.game.castCategoryVote, { ...ballotArgs(first, token()), category: first.categoryVote!.choices[0] })).rejects.toThrow("session");
  await expect(convex.mutation(api.game.castCategoryVote, { ...ballotArgs(first, sessionToken), category: "mixed" })).rejects.toThrow("three categories");
  const nominees: string[] = [];
  const winners: string[] = [];
  for (let round = 1; round <= 3; round++) {
    const current = await snapshot();
    const choices = current.categoryVote!.choices;
    expect(current.categoryVote!.round).toBe(round);
    expect(choices).toHaveLength(3);
    nominees.push(...choices);
    winners.push(choices[0]);
    const hostArgs = { ...ballotArgs(current, sessionToken), category: choices[0] };
    await Promise.all([convex.mutation(api.game.castCategoryVote, hostArgs), convex.mutation(api.game.castCategoryVote, hostArgs)]);
    expect((await snapshot()).categoryVote?.votedCount).toBe(1);
    const guest = await snapshot(sessions[1].sessionToken);
    expect(guest.categoryVote).toMatchObject({ choices, myVote: null, votedCount: 1 });
    expect(guest.game).not.toHaveProperty("category_vote");
    expect(Object.keys(guest.categoryVote!).sort()).toEqual(["choices", "id", "myVote", "round", "status", "totalRounds", "votedCount", "voterCount"].sort());
    const anonymous = await convex.query(api.game.loadSnapshot, { gameId });
    expect(anonymous).not.toHaveProperty("categoryVote");
    expect(anonymous!.game).not.toHaveProperty("category_vote");
    await Promise.all(sessions.slice(1).map((session) => convex.mutation(api.game.castCategoryVote, { ...ballotArgs(current, session.sessionToken), category: choices[0] })));
    await expect(convex.mutation(api.game.castCategoryVote, hostArgs)).rejects.toThrow("ended");
  }
  expect(new Set(nominees).size).toBe(9);
  const complete = await snapshot();
  expect(complete.categoryVote).toMatchObject({ status: "complete", choices: [], myVote: null });
  expect(complete.game.prompt_categories).toEqual(["mixed"]);
  expect(complete.prompts).toHaveLength(10);
  expect(complete.prompts.every((p) => p.text === "" && p.category === null && p.description === null)).toBe(true);
  const raw = await loadSeededSnapshot(gameId);
  expect(new Set(raw.prompts.map((p) => p.text)).size).toBe(10);
  expect(new Set(raw.prompts.map((p) => p.category))).toEqual(new Set(winners));
  const counts = winners.map((c) => raw.prompts.filter((p) => p.category === c).length);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  await convex.mutation(api.game.startGame, matchArgs(complete, sessionToken));
  const roundsSeen = new Set<number>();
  for (let step = 0; step < 40; step++) {
    const state = await snapshot();
    if (state.game.phase === "finished") break;
    roundsSeen.add(state.game.round_number);
    const activeToken = sessions.find((s) => s.id === state.game.active_player_id)!.sessionToken;
    if (state.game.phase === "ready") await convex.mutation(api.game.startTurn, { ...matchArgs(state, activeToken), expectedTurnNumber: state.game.turn_number });
    else {
      const view = await snapshot(activeToken);
      expect(view.prompts.filter((p) => p.text)).toHaveLength(1);
      const spectator = sessions.find((s) => s.sessionToken !== activeToken)!;
      expect((await snapshot(spectator.sessionToken)).prompts.every((p) => !p.text)).toBe(true);
      await convex.mutation(api.game.markCorrect, actionArgs(view, activeToken));
    }
  }
  const finished = await snapshot();
  expect(finished.game.phase).toBe("finished");
  expect(roundsSeen).toEqual(new Set([1, 2, 3]));
  expect(finished.teams.reduce((total, team) => total + team.score, 0)).toBe(30);
  await convex.mutation(api.game.resetToLobby, { ...matchArgs(finished, sessionToken), freshCards: false });
  expect((await snapshot()).categoryVote?.status).toBe("complete");
  expect((await loadSeededSnapshot(gameId)).prompts.map((p) => p.text).sort()).toEqual(raw.prompts.map((p) => p.text).sort());
  await convex.mutation(api.game.startGame, matchArgs(await snapshot(), sessionToken));
  await convex.mutation(api.game.finishGame, matchArgs(await snapshot(), sessionToken));
  await convex.mutation(api.game.resetToLobby, { ...matchArgs(await snapshot(), sessionToken), freshCards: true });
  const fresh = await snapshot();
  expect(fresh.game.deck_selection).toBe("vote");
  expect(fresh.categoryVote?.status).toBe("waiting");
  expect(fresh.prompts).toHaveLength(0);
  expect(fresh.draftCards).toHaveLength(0);
  await convex.mutation(api.game.startCategoryVoting, matchArgs(fresh, sessionToken));
  await expect(convex.mutation(api.game.castCategoryVote, { ...ballotArgs(first, sessionToken), category: first.categoryVote!.choices[0] })).rejects.toThrow("ended");
});

test("host closes missing-player ballots with random ties; version/mode restrictions and late joins are enforced", async () => {
  const { convex, gameId, sessions, sessionToken, setup, snapshot, code } = await room(3, 80, 1);
  await convex.mutation(api.game.startCategoryVoting, matchArgs(await snapshot(), sessionToken));
  const current = await snapshot();
  await expect(convex.mutation(api.game.closeCategoryVoteRound, ballotArgs(current, sessions[1].sessionToken))).rejects.toThrow("host");
  await expect(convex.mutation(api.game.closeCategoryVoteRound, ballotArgs(current, sessionToken))).rejects.toThrow("At least one");
  for (let i = 0; i < 2; i++) await convex.mutation(api.game.castCategoryVote, { ...ballotArgs(current, sessions[i].sessionToken), category: current.categoryVote!.choices[i] });
  await convex.mutation(api.game.closeCategoryVoteRound, ballotArgs(current, sessionToken));
  await expect(convex.mutation(api.game.closeCategoryVoteRound, ballotArgs(current, sessionToken))).rejects.toThrow("ended");
  const raw = await loadSeededSnapshot(gameId);
  expect(raw.prompts).toHaveLength(80);
  expect(new Set(raw.prompts.map((p) => p.category)).size).toBe(1);
  expect(current.categoryVote!.choices.slice(0, 2)).toContain(raw.prompts[0].category);
  const late = await convex.mutation(api.game.joinGame, { code, sessionToken: token(), playerName: "Late" });
  expect(late.player.has_submitted).toBe(true);
  expect(late.game).not.toHaveProperty("category_vote");
  await expect(convex.mutation(api.game.saveGameSetup, { ...setup, playMode: "pass_and_play" })).rejects.toThrow("own phone");
  await expect(convex.mutation(api.game.saveGameSetup, { ...setup, promptMode: "free" })).rejects.toThrow("built-in");
  const legacyToken = token();
  const legacy = await convex.mutation(api.game.createGame, { hostName: "V1", sessionToken: legacyToken });
  ids.push(legacy.game.id);
  await convex.mutation(api.game.setGameVersion, { gameId: legacy.game.id, sessionToken: legacyToken, gameVersion: "v1" });
  await expect(convex.mutation(api.game.saveGameSetup, { ...setup, gameId: legacy.game.id, sessionToken: legacyToken })).rejects.toThrow("V2");
  await expect(convex.mutation(api.game.castCategoryVote, { ...ballotArgs(current, legacyToken), category: current.categoryVote!.choices[0] })).rejects.toThrow("session");
  await convex.mutation(api.game.saveGameSetup, { ...setup, deckSelection: "draft" });
  expect((await snapshot()).categoryVote).toBeUndefined();
  expect((await snapshot()).draftCards).toHaveLength(4);
});

test("random category bowls meet capacity and balance across supported card and category counts", () => {
  for (const cardCount of [10, 40, 80]) for (const rounds of [1, 2, 3]) {
    const ballots = createCategoryBallots(cardCount, rounds);
    expect(new Set(ballots.flat()).size).toBe(3 * rounds);
    // Exercise every possible winning combination, including the smallest pools.
    let mixes: string[][] = [[]];
    for (const ballot of ballots) mixes = mixes.flatMap((mix) => ballot.map((category) => [...mix, category]));
    for (const winners of mixes) {
      const cards = buildVotedBowl(cardCount, winners);
      expect(cards).toHaveLength(cardCount);
      expect(new Set(cards.map((card) => card.title)).size).toBe(cardCount);
      const counts = winners.map((category) => cards.filter((card) => card.category === category).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      const fresh = buildVotedBowl(cardCount, winners, cards.map((c) => c.title));
      expect(fresh).toHaveLength(cardCount);
    }
  }
  expect(chooseCategoryWinner(["a", "b", "c"], ["a", "a", "b"])).toBe("a");
  expect(() => chooseCategoryWinner(["a", "b", "c"], [])).toThrow("At least one");
});

test("voting advances once for both two-player and twelve-player groups", async () => {
  for (const playerCount of [2, 12]) {
    const { convex, sessions, sessionToken, snapshot } = await room(playerCount, 40, 2);
    await convex.mutation(api.game.startCategoryVoting, matchArgs(await snapshot(), sessionToken));
    for (let round = 1; round <= 2; round++) {
      const current = await snapshot();
      expect(current.categoryVote).toMatchObject({ round, voterCount: playerCount, votedCount: 0 });
      await Promise.all(sessions.map((session, index) => convex.mutation(api.game.castCategoryVote, { ...ballotArgs(current, session.sessionToken), category: current.categoryVote!.choices[index % 3] })));
    }
    const complete = await snapshot();
    expect(complete.categoryVote?.status).toBe("complete");
    expect(complete.prompts).toHaveLength(40);
  }
});
