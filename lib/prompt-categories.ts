import { hasFamilyFriendlyDeckFilter, MIXED_PASS_PLAY_CATEGORY, PASS_PLAY_CATEGORY_OPTIONS } from "./pass-play-deck";
import type { PassPlayCategoryId } from "./pass-play-deck";

export const SIMPLE_PROMPT_CATEGORIES = [
  "Celebrity",
  "Movie",
  "Animal",
  "Food",
  "Fictional character",
  "Song",
  "Historical figure",
  "Household object",
  "TV show",
  "Landmark",
  "Brand",
  "Job",
  "Video game",
  "Book",
  "Musician",
  "City",
  "Vehicle",
  "Superhero",
  "Villain",
  "Board game",
  "App or website",
  "Restaurant",
  "Cartoon character",
  "Someone in the room",
  "Toy",
  "Famous place",
  "School subject",
  "Holiday"
];

const FAMILY_PROMPT_CATEGORIES = [
  "Animal",
  "Food",
  "Cartoon character",
  "Toy",
  "School subject",
  "Book character",
  "Video game character",
  "Pet",
  "Place at school",
  "Thing in a backpack",
  "Playground activity",
  "Holiday",
  "Board game",
  "Vehicle",
  "Something at the zoo",
  "Something at a birthday party",
  "Something you draw",
  "Something you build",
  "A silly job",
  "A friendly monster"
];

const CATEGORY_GROUPS: Record<PassPlayCategoryId, string[]> = {
  people: [
    "Celebrity",
    "Historical figure",
    "Musician",
    "Comedian",
    "Famous internet person",
    "Someone in the room",
    "Reality TV person"
  ],
  movies: [
    "Movie",
    "TV show",
    "Movie character",
    "TV character",
    "Actor",
    "Animated movie",
    "Movie villain",
    "Streaming show"
  ],
  music: [
    "Song",
    "Musician",
    "Band",
    "Pop star",
    "Music video",
    "Concert moment",
    "Album",
    "Singer"
  ],
  fiction_games: [
    "Fictional character",
    "Superhero",
    "Villain",
    "Video game",
    "Board game",
    "Cartoon character",
    "Book character",
    "Fantasy creature"
  ],
  places_objects: [
    "Household object",
    "Landmark",
    "City",
    "Vehicle",
    "Brand",
    "Toy",
    "App or website",
    "Famous place"
  ],
  animals_nature: [
    "Animal",
    "Dinosaur",
    "Sea creature",
    "Bird",
    "Plant or flower",
    "Weather event",
    "Natural landmark",
    "Pet"
  ],
  food_drink: [
    "Food",
    "Drink",
    "Dessert",
    "Snack",
    "Breakfast food",
    "Restaurant order",
    "Ingredient",
    "Condiment"
  ],
  sports: [
    "Sport",
    "Sports equipment",
    "Sports move",
    "Sports place",
    "Famous athlete",
    "Game rule",
    "Trophy or medal",
    "Olympic event"
  ],
  science_tech: [
    "Gadget",
    "Space thing",
    "Science tool",
    "Computer thing",
    "Medical tool",
    "Invention",
    "Internet thing",
    "Energy source"
  ],
  jobs_hobbies: [
    "Job",
    "Hobby",
    "Creative activity",
    "Outdoor activity",
    "Trade skill",
    "Performer",
    "Community helper",
    "Group activity"
  ],
  internet_memes: [
    "Internet meme",
    "Viral phrase",
    "Reaction image",
    "Social media trend",
    "TikTok trend",
    "Online slang",
    "Viral character",
    "Meme format"
  ]
};

export const COMBO_PROMPT_CATEGORIES = [
  "A celebrity doing a chore",
  "An animal with a job",
  "A fictional character at the grocery store",
  "A historical figure using modern technology",
  "A food item with a personality",
  "A superhero with a boring problem",
  "A villain doing customer service",
  "A cartoon character on a first date",
  "A fictional character stuck at the DMV",
  "A celebrity trying to be sneaky",
  "A movie character at a wedding",
  "A famous person ordering fast food",
  "A brand mascot having a bad day"
];

export function getPromptCategoriesForPlayer(gameId: string, playerId: string, count: number, selectedCategoryIds: string[] = [MIXED_PASS_PLAY_CATEGORY]) {
  const seed = hashString(`${gameId}:${playerId}`);
  if (hasFamilyFriendlyDeckFilter(selectedCategoryIds)) {
    const familyCategories = shuffleWithSeed(FAMILY_PROMPT_CATEGORIES, seed);
    return Array.from({ length: count }, (_, index) => familyCategories[index % familyCategories.length]);
  }

  const selectedGroups = getSelectedGroups(selectedCategoryIds);
  const selectedSimple = selectedGroups.flatMap((group) => CATEGORY_GROUPS[group]).filter((category) => !COMBO_PROMPT_CATEGORIES.includes(category));
  const simple = shuffleWithSeed(selectedSimple.length > 0 ? selectedSimple : SIMPLE_PROMPT_CATEGORIES, seed);
  const categories: string[] = [];

  for (let index = 0; index < count; index += 1) {
    categories.push(simple[index % simple.length]);
  }

  return shuffleWithSeed(categories, seed * 31 + 11);
}

function getSelectedGroups(selectedCategoryIds: string[]) {
  const useMixed = selectedCategoryIds.includes(MIXED_PASS_PLAY_CATEGORY) || selectedCategoryIds.length === 0;
  if (useMixed) return PASS_PLAY_CATEGORY_OPTIONS.map((category) => category.id);

  const validGroups = selectedCategoryIds.filter((categoryId): categoryId is PassPlayCategoryId =>
    PASS_PLAY_CATEGORY_OPTIONS.some((category) => category.id === categoryId)
  );
  return validGroups.length > 0 ? validGroups : PASS_PLAY_CATEGORY_OPTIONS.map((category) => category.id);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const copy = [...items];
  let state = seed || 1;

  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}
