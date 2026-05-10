import { STARTER_DECK, isFamilyFriendlyCard, type StarterDeckCard } from "./starter-deck";
import { shuffle } from "./game-utils";

export type PassPlayCategoryId =
  | "people"
  | "movies"
  | "music"
  | "fiction_games"
  | "places_objects"
  | "animals_nature"
  | "food_drink"
  | "sports"
  | "science_tech"
  | "jobs_hobbies"
  | "internet_memes";

export const MIXED_PASS_PLAY_CATEGORY = "mixed";
export const FAMILY_FRIENDLY_DECK_FILTER = "family_friendly";

export const PASS_PLAY_CATEGORY_OPTIONS: Array<{ id: PassPlayCategoryId; label: string }> = [
  { id: "people", label: "People & Celebrities" },
  { id: "movies", label: "Movies & TV" },
  { id: "music", label: "Music" },
  { id: "fiction_games", label: "Fiction & Games" },
  { id: "places_objects", label: "Places & Things" },
  { id: "animals_nature", label: "Animals & Nature" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "sports", label: "Sports" },
  { id: "science_tech", label: "Science & Tech" },
  { id: "jobs_hobbies", label: "Jobs & Hobbies" },
  { id: "internet_memes", label: "Internet & Memes" }
];

export type PassPlayDeckCard = StarterDeckCard & {
  category: PassPlayCategoryId;
};

export function getDefaultPassPlayCardCount(playerCount: number) {
  if (playerCount <= 3) return 30;
  if (playerCount <= 6) return 40;
  if (playerCount <= 10) return 45;
  if (playerCount <= 16) return 50;
  return 45;
}

export function buildPassPlayDeck(cardCount: number, selectedCategories: string[]) {
  const cleanCount = Math.min(80, Math.max(10, Math.round(cardCount)));
  const useMixed = shouldUseMixedCategories(selectedCategories);
  const categoryIds = getSelectedPassPlayCategoryIds(selectedCategories);

  const categorizedCards = getFilteredStarterDeck(selectedCategories);
  if (!useMixed) {
    return shuffle(categorizedCards.filter((card) => categoryIds.includes(card.category))).slice(0, cleanCount);
  }

  const buckets = categoryIds.map((category) => shuffle(categorizedCards.filter((card) => card.category === category)));
  const mixedCards: PassPlayDeckCard[] = [];
  let bucketIndex = 0;

  while (mixedCards.length < cleanCount && buckets.some((bucket) => bucket.length > 0)) {
    const bucket = buckets[bucketIndex % buckets.length];
    const nextCard = bucket.shift();
    if (nextCard) mixedCards.push(nextCard);
    bucketIndex += 1;
  }

  return mixedCards;
}

export function filterStarterDeckByCategories(selectedCategories: string[]) {
  const useMixed = shouldUseMixedCategories(selectedCategories);
  const categoryIds = getSelectedPassPlayCategoryIds(selectedCategories);
  const categorizedCards = getFilteredStarterDeck(selectedCategories);
  return useMixed ? categorizedCards : categorizedCards.filter((card) => categoryIds.includes(card.category));
}

function shouldUseMixedCategories(selectedCategories: string[]) {
  return selectedCategories.includes(MIXED_PASS_PLAY_CATEGORY) || selectedCategories.length === 0;
}

function getSelectedPassPlayCategoryIds(selectedCategories: string[]) {
  const categoryIds = shouldUseMixedCategories(selectedCategories)
    ? PASS_PLAY_CATEGORY_OPTIONS.map((category) => category.id)
    : selectedCategories.filter((category): category is PassPlayCategoryId =>
        PASS_PLAY_CATEGORY_OPTIONS.some((option) => option.id === category)
      );

  return categoryIds.length > 0 ? categoryIds : PASS_PLAY_CATEGORY_OPTIONS.map((category) => category.id);
}

export function hasFamilyFriendlyDeckFilter(selectedCategories: string[]) {
  return selectedCategories.includes(FAMILY_FRIENDLY_DECK_FILTER);
}

export function setFamilyFriendlyDeckFilter(selectedCategories: string[], enabled: boolean) {
  const withoutFilter = selectedCategories.filter((category) => category !== FAMILY_FRIENDLY_DECK_FILTER);
  return enabled ? [...withoutFilter, FAMILY_FRIENDLY_DECK_FILTER] : withoutFilter;
}

function getFilteredStarterDeck(selectedCategories: string[]) {
  const sourceCards = hasFamilyFriendlyDeckFilter(selectedCategories)
    ? STARTER_DECK.filter((card) => isFamilyFriendlyCard(card.id))
    : STARTER_DECK;

  const categorizedCards = sourceCards
    .map((card) => {
      const category = getCardCategory(card);
      return category ? { ...card, category } : null;
    })
    .filter((card): card is PassPlayDeckCard => Boolean(card));

  return uniqueCardsByVisibleTitle(categorizedCards);
}

function uniqueCardsByVisibleTitle(cards: PassPlayDeckCard[]) {
  const seenTitles = new Set<string>();
  const uniqueCards: PassPlayDeckCard[] = [];

  for (const card of cards) {
    const normalizedTitle = normalizeVisibleTitle(card.title);
    if (seenTitles.has(normalizedTitle)) continue;
    seenTitles.add(normalizedTitle);
    uniqueCards.push(card);
  }

  return uniqueCards;
}

function normalizeVisibleTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCardCategory(card: StarterDeckCard): PassPlayCategoryId | null {
  if (card.category === "situations") {
    return null;
  }

  if (card.category && PASS_PLAY_CATEGORY_OPTIONS.some((option) => option.id === card.category)) {
    return card.category as PassPlayCategoryId;
  }

  const override = CARD_CATEGORY_OVERRIDES[card.id];
  if (override === "situations") return null;
  if (override) return override;

  const text = `${card.id} ${card.title} ${card.description}`.toLowerCase();

  if (card.id.startsWith("tmdb-movie") || hasAny(text, ["movie", "film", "tv series", "hbo", "sitcom"])) return "movies";
  if (hasAny(text, ["singer", "song", "band", "music", "pop star", "rapper", "guitar", "beatles", "album"])) return "music";
  if (hasAny(text, ["superhero", "villain", "star wars", "harry potter", "nintendo", "video game", "comic", "jedi", "wizard"])) {
    return "fiction_games";
  }
  if (hasAny(text, ["animal", "shark", "dinosaur", "t. rex", "cactus", "storm", "weather", "forest", "wildlife", "chimpanzee"])) {
    return "animals_nature";
  }
  if (hasAny(text, ["airport", "tower", "chair", "truck", "map", "machine", "balloon", "factory", "moon", "paris", "luggage"])) {
    return "places_objects";
  }
  if (hasAny(text, ["president", "actor", "comedian", "artist", "monarch", "scientist", "pilot", "pharaoh", "host", "star"])) return "people";
  return null;
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

const CARD_CATEGORY_OVERRIDES: Record<string, PassPlayCategoryId | "situations"> = {
  "amelia-earhart": "people",
  "apollo-11": "places_objects",
  beyonce: "music",
  bigfoot: "animals_nature",
  "bob-ross": "people",
  cleopatra: "people",
  "darth-vader": "fiction_games",
  "dolly-parton": "music",
  "eiffel-tower": "places_objects",
  "elvis-presley": "music",
  "frida-kahlo": "people",
  "george-washington": "people",
  godzilla: "movies",
  "harriet-tubman": "people",
  "hermione-granger": "fiction_games",
  "jane-goodall": "people",
  jaws: "movies",
  mario: "fiction_games",
  "mona-lisa": "places_objects",
  "oprah-winfrey": "people",
  picasso: "people",
  "queen-elizabeth-ii": "people",
  "sherlock-holmes": "fiction_games",
  "spider-man": "fiction_games",
  "taylor-swift": "music",
  "the-beatles": "music",
  "the-rock": "people",
  "t-rex": "animals_nature",
  "willy-wonka": "fiction_games",
  yoda: "fiction_games",
  zeus: "fiction_games",
  "airport-security": "situations",
  "alien-job-interview": "situations",
  "baby-shark": "music",
  "bad-gps": "situations",
  "birthday-cake": "places_objects",
  "black-friday": "situations",
  "broken-umbrella": "places_objects",
  cactus: "animals_nature",
  "celebrity-chef": "situations",
  "coffee-shop-wifi": "situations",
  "courtroom-objection": "situations",
  "dad-joke": "situations",
  "dance-battle": "situations",
  "dentist-chair": "places_objects",
  "elevator-small-talk": "situations",
  "escape-room": "situations",
  "family-road-trip": "situations",
  "fashion-runway": "situations",
  "fire-drill": "situations",
  "fortune-cookie": "places_objects",
  "garage-band": "situations",
  "haunted-house": "situations",
  "hot-air-balloon": "places_objects",
  "ice-cream-truck": "places_objects",
  "karaoke-night": "situations",
  "lost-luggage": "situations",
  "magic-trick": "situations",
  "mall-santa": "situations",
  "mime-stuck-in-box": "situations",
  "office-printer": "places_objects",
  "opera-singer": "situations",
  "parking-ticket": "situations",
  "pirate-captain": "situations",
  "pizza-delivery": "situations",
  "prom-posal": "situations",
  "reality-show-villain": "situations",
  "roller-coaster": "situations",
  "school-picture-day": "situations",
  "secret-agent": "situations",
  "silent-disco": "situations",
  "speed-dating": "situations",
  "spelling-bee": "situations",
  "summer-camp": "situations",
  "surprise-party": "situations",
  "taco-truck": "places_objects",
  "talent-show": "situations",
  "taxi-driver": "situations",
  "tech-support": "situations",
  "theme-park-map": "places_objects",
  thunderstorm: "animals_nature",
  "time-traveler": "situations",
  "treasure-map": "places_objects",
  "trivia-host": "situations",
  "valet-parking": "situations",
  "vending-machine": "places_objects",
  "wedding-dj": "situations",
  "yoga-class": "situations",
  "zombie-apocalypse": "situations",
  "wiki-michael-jackson": "music",
  "wiki-euphoria-american-tv-series": "movies",
  "wiki-project-hail-mary-film": "movies",
  "wiki-jaafar-jackson": "people",
  "wiki-the-boys": "movies",
  "wiki-bhooth-bangla": "movies",
  "wiki-d4vd": "music",
  "wiki-jermaine-jackson": "music",
  "wiki-justin-bieber": "music",
  "wiki-charlize-theron": "people",
  "wiki-meryl-streep": "people",
  "wiki-anthropic": "places_objects",
  "wiki-janet-jackson": "music",
  "wiki-robin-williams": "people",
  "wiki-olivia-rodrigo": "music",
  "wiki-bts": "music",
  "wiki-clayface": "fiction_games",
  "wiki-invincible-comics": "fiction_games",
  "wiki-witch-hat-atelier": "fiction_games",
  "wiki-david-bowie": "music",
  "wiki-brad-pitt": "people",
  "wiki-billie-eilish": "music",
  "wiki-harry-styles": "music",
  "wiki-marilyn-monroe": "people",
  "wiki-bob-dylan": "music",
  "wiki-cher": "music",
  "wiki-mortal-kombat": "fiction_games",
  "wiki-jack-white": "music",
  "wiki-pursuit-of-jade": "movies",
  "wiki-sinitta": "music",
  "wiki-nikki-glaser": "people",
  "wiki-john-lennon": "music",
  "wiki-hells-kitchen": "movies",
  "wiki-enya": "music",
  "wiki-fleetwood-mac": "music",
  "wiki-megan-thee-stallion": "music",
  "wiki-eminem": "music"
};
