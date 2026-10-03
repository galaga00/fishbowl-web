import { filterStarterDeckByCategories, PASS_PLAY_CATEGORY_OPTIONS } from "./pass-play-deck";
import { shuffle } from "./game-utils";
import type { Game } from "./types";

export function usesCategoryVote(game: Pick<Game, "prompt_mode" | "play_mode" | "deck_selection">) {
  return game.prompt_mode === "deck" && game.play_mode === "multi_device" && game.deck_selection === "vote";
}

// Disjoint ballots keep later nominations from revealing an earlier winner.
// Every nominee can supply its share, even if all the smallest categories win.
export function createCategoryBallots(cardCount: number, rounds: number) {
  const minimumPool = Math.ceil(cardCount / rounds);
  const eligible = PASS_PLAY_CATEGORY_OPTIONS.filter(({ id }) => filterStarterDeckByCategories([id]).length >= minimumPool);
  if (eligible.length < rounds * 3) throw new Error("Not enough categories for this bowl. Choose fewer cards or voting rounds.");
  const shuffled = shuffle(eligible).map(({ id }) => id);
  return Array.from({ length: rounds }, (_, round) => shuffled.slice(round * 3, round * 3 + 3));
}

export function chooseCategoryWinner(choices: string[], votes: string[]) {
  if (!votes.length) throw new Error("At least one person needs to vote before closing this round.");
  const totals = choices.map((category) => ({ category, count: votes.filter((vote) => vote === category).length }));
  const high = Math.max(...totals.map(({ count }) => count));
  return shuffle(totals.filter(({ count }) => count === high))[0].category;
}

export function buildVotedBowl(cardCount: number, winners: string[], previousTitles: string[] = []) {
  const previous = new Set(previousTitles);
  const pool = filterStarterDeckByCategories(winners);
  const buckets = shuffle(winners).map((category) => {
    const cards = pool.filter((card) => card.category === category);
    return [...shuffle(cards.filter((card) => !previous.has(card.title))), ...shuffle(cards.filter((card) => previous.has(card.title)))];
  });
  const cards = [];
  for (let index = 0; index < cardCount; index++) {
    const card = buckets[index % buckets.length]?.shift();
    if (!card) throw new Error("This category mix cannot fill the bowl. Ask the host to edit setup.");
    cards.push(card);
  }
  return shuffle(cards);
}
