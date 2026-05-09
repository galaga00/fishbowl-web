import fs from "node:fs";
import path from "node:path";
import { STARTER_DECK } from "../lib/starter-deck";
import {
  FAMILY_FRIENDLY_DECK_FILTER,
  MIXED_PASS_PLAY_CATEGORY,
  PASS_PLAY_CATEGORY_OPTIONS,
  type PassPlayCategoryId,
  type PassPlayDeckCard,
  filterStarterDeckByCategories
} from "../lib/pass-play-deck";

type ReviewCategoryId = PassPlayCategoryId | "family_friendly";

type CandidateCard = {
  status: "KEEP";
  category: ReviewCategoryId;
  categoryLabel: string;
  id: string;
  title: string;
  description: string;
  source: string;
};

type WikidataRow = {
  item?: { value?: string };
  itemLabel?: { value?: string };
  itemDescription?: { value?: string };
};

type WikipediaSummary = {
  title?: string;
  description?: string;
  extract?: string;
  type?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

const OUTPUT_DIR = path.join("card-review", "target-fill");
const TARGET_PER_CATEGORY = Number(process.env.TARGET_PER_CATEGORY ?? 440);
const TARGET_FAMILY_FRIENDLY = Number(process.env.TARGET_FAMILY_FRIENDLY ?? 440);
const USER_AGENT = "fish-bowl-target-card-review/1.0";

const CATEGORY_FILES: Record<ReviewCategoryId, string> = {
  people: "people.md",
  movies: "movies-tv.md",
  music: "music.md",
  fiction_games: "fiction-games.md",
  places_objects: "places-things.md",
  situations: "situations.md",
  animals_nature: "animals-nature.md",
  family_friendly: "family-friendly.md"
};

const CATEGORY_SOURCES: Partial<Record<PassPlayCategoryId, Array<{ source: string; query: string }>>> = {
  people: [
    {
      source: "wikidata",
      query: `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  ?item wdt:P31 wd:Q5;
        wikibase:sitelinks ?sitelinks;
        wdt:P106 ?occupation.
  VALUES ?occupation { wd:Q33999 wd:Q177220 wd:Q639669 wd:Q245068 wd:Q947873 wd:Q2405480 wd:Q10800557 wd:Q2526255 wd:Q36180 wd:Q1028181 }
  FILTER(?sitelinks >= 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 900`
    }
  ],
  movies: [
    {
      source: "wikidata",
      query: `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  ?item wikibase:sitelinks ?sitelinks;
        wdt:P31 ?type.
  VALUES ?type { wd:Q11424 wd:Q5398426 wd:Q15416 wd:Q24856 wd:Q21191270 wd:Q506240 }
  FILTER(?sitelinks >= 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 700`
    }
  ],
  music: [
    {
      source: "wikidata",
      query: `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  ?item wikibase:sitelinks ?sitelinks;
        wdt:P31 ?type.
  VALUES ?type { wd:Q215380 wd:Q177220 wd:Q639669 wd:Q7366 wd:Q482994 wd:Q134556 wd:Q105543609 }
  FILTER(?sitelinks >= 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 900`
    }
  ],
  fiction_games: [
    {
      source: "wikidata",
      query: `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  ?item wikibase:sitelinks ?sitelinks;
        wdt:P31 ?type.
  VALUES ?type { wd:Q7889 wd:Q95074 wd:Q131436 wd:Q11410 wd:Q15711870 wd:Q15632617 wd:Q1569167 wd:Q838795 }
  FILTER(?sitelinks >= 12)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 900`
    }
  ],
  places_objects: [
    {
      source: "wikidata",
      query: `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  ?item wikibase:sitelinks ?sitelinks;
        wdt:P31 ?type.
  VALUES ?type { wd:Q570116 wd:Q2319498 wd:Q41176 wd:Q515 wd:Q431289 wd:Q2424752 wd:Q11422 wd:Q39546 wd:Q811979 wd:Q3957 wd:Q83620 }
  FILTER(?sitelinks >= 12)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 1000`
    }
  ],
  animals_nature: [
    {
      source: "wikidata",
      query: `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  ?item wikibase:sitelinks ?sitelinks;
        wdt:P31 ?type.
  VALUES ?type { wd:Q729 wd:Q16521 wd:Q8502 wd:Q4022 wd:Q35509 wd:Q8072 wd:Q1322005 wd:Q756 wd:Q5113 wd:Q25326 wd:Q41960 }
  FILTER(?sitelinks >= 12)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 1000`
    }
  ]
};

const WIKIPEDIA_CATEGORY_FALLBACKS: Partial<Record<PassPlayCategoryId, string[]>> = {
  people: [
    "American_film_actors",
    "American_television_actors",
    "American_comedians",
    "American_YouTubers",
    "British_film_actors",
    "British_comedians",
    "Canadian_film_actors",
    "Television_presenters",
    "Celebrity_chefs",
    "Internet_celebrities"
  ],
  animals_nature: [
    "Mammals",
    "Birds",
    "Reptiles",
    "Dinosaurs",
    "Dog_breeds",
    "Cat_breeds",
    "Natural_landmarks",
    "Weather_phenomena",
    "Trees",
    "Flowers"
  ],
  places_objects: [
    "Tourist_attractions_in_the_United_States",
    "Landmarks_in_the_United_States",
    "Fast-food_chains",
    "Toy_brands",
    "Consumer_electronics_brands"
  ]
};

const CATEGORY_LABELS: Record<ReviewCategoryId, string> = {
  ...Object.fromEntries(PASS_PLAY_CATEGORY_OPTIONS.map((category) => [category.id, category.label])),
  family_friendly: "Family Friendly"
} as Record<ReviewCategoryId, string>;
const CATEGORY_IDS: PassPlayCategoryId[] = PASS_PLAY_CATEGORY_OPTIONS.map((category) => category.id);
const REVIEW_CATEGORY_IDS: ReviewCategoryId[] = [...CATEGORY_IDS, "family_friendly"];
const currentDeck = filterStarterDeckByCategories([MIXED_PASS_PLAY_CATEGORY]) as PassPlayDeckCard[];
const currentFamilyDeck = filterStarterDeckByCategories([MIXED_PASS_PLAY_CATEGORY, FAMILY_FRIENDLY_DECK_FILTER]);
const existingTitles = new Set(STARTER_DECK.map((card) => normalizedTitle(card.title)));
const existingIds = new Set(STARTER_DECK.map((card) => card.id));
const generatedTitles = new Set(existingTitles);
const generatedIds = new Set(existingIds);

const currentCounts = countBy(currentDeck, (card) => card.category);
const familyCurrentCount = currentFamilyDeck.length;
const regularNeeds = Object.fromEntries(CATEGORY_IDS.map((category) => [category, Math.max(0, TARGET_PER_CATEGORY - (currentCounts.get(category) ?? 0))])) as Record<PassPlayCategoryId, number>;
const familyNeed = Math.max(0, TARGET_FAMILY_FRIENDLY - familyCurrentCount);

const candidatesByCategory = Object.fromEntries(REVIEW_CATEGORY_IDS.map((category) => [category, []])) as unknown as Record<ReviewCategoryId, CandidateCard[]>;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  for (const category of CATEGORY_IDS) {
    console.log(`Generating ${category}: need ${regularNeeds[category]}`);
    const wanted = regularNeeds[category];
    if (wanted === 0) continue;

    const candidates = category === "situations"
      ? generatedSituationCards(wanted)
      : category === "animals_nature"
        ? generatedAnimalsNatureCards(wanted)
      : await wikidataCardsForCategory(category, wanted);

    candidatesByCategory[category].push(...candidates.slice(0, wanted));
  }

  console.log(`Generating family-friendly: need ${familyNeed}`);
  candidatesByCategory.family_friendly.push(...generatedFamilyFriendlyCards(familyNeed).slice(0, familyNeed));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const allCandidates = Object.values(candidatesByCategory).flat();
  fs.writeFileSync(path.join(OUTPUT_DIR, "candidates.json"), `${JSON.stringify(allCandidates, null, 2)}\n`);
  for (const category of REVIEW_CATEGORY_IDS) {
    fs.writeFileSync(path.join(OUTPUT_DIR, CATEGORY_FILES[category]), markdownForCategory(category, candidatesByCategory[category]));
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, "README.md"), reviewIndexMarkdown(candidatesByCategory));

  console.log(`Wrote ${allCandidates.length} candidates to ${OUTPUT_DIR}`);
}

async function wikidataCardsForCategory(category: PassPlayCategoryId, wanted: number): Promise<CandidateCard[]> {
  const sources = CATEGORY_SOURCES[category] ?? [];
  const cards: CandidateCard[] = [];
  for (const source of sources) {
    let rows = [];
    try {
      rows = await fetchWikidata(source.query);
    } catch (error) {
      console.warn(`Skipping ${category} source after fetch failure: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const row of rows) {
      if (cards.length >= wanted) break;
      const title = cleanTitle(row.itemLabel?.value ?? "");
      const rawDescription = row.itemDescription?.value ?? "";
      const description = makeDescription(title, rawDescription, category);
      const sourceUrl = row.item?.value ?? "";
      const card = makeCard({ title, description, category, source: sourceUrl });
      if (!card) continue;
      cards.push(card);
    }
  }

  if (cards.length < wanted) {
    cards.push(...await wikipediaFallbackCardsForCategory(category, wanted - cards.length));
  }

  if (cards.length < wanted) {
    cards.push(...generatedFallbackCards(category, wanted - cards.length));
  }
  return cards;
}

async function wikipediaFallbackCardsForCategory(category: PassPlayCategoryId, wanted: number): Promise<CandidateCard[]> {
  const categories = WIKIPEDIA_CATEGORY_FALLBACKS[category] ?? [];
  if (categories.length === 0 || wanted <= 0) return [];

  const titles: string[] = [];
  for (const wikipediaCategory of categories) {
    const members = await wikipediaCategoryMembers(wikipediaCategory, 220);
    for (const title of members) {
      if (titles.length >= wanted * 4) break;
      titles.push(title);
    }
  }

  const cards: CandidateCard[] = [];
  for (let index = 0; index < titles.length && cards.length < wanted; index += 8) {
    const batch = titles.slice(index, index + 8);
    const summaries = await Promise.all(batch.map((title) => wikipediaSummary(title).catch(() => null)));
    for (const summary of summaries) {
      if (!summary || cards.length >= wanted) continue;
      const title = cleanTitle(summary.title ?? "");
      const description = makeDescription(title, summary.description || summary.extract || "", category);
      const card = makeCard({
        title,
        description,
        category,
        source: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
      });
      if (card) cards.push(card);
    }
  }
  return cards;
}

async function wikipediaCategoryMembers(category: string, limit: number): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue = "";

  while (titles.length < limit) {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "50",
      cmnamespace: "0",
      format: "json",
      origin: "*"
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "user-agent": USER_AGENT }
    });
    if (!response.ok) break;
    const data = await response.json();
    titles.push(...(data.query?.categorymembers ?? []).map((member: { title: string }) => member.title));
    cmcontinue = data.continue?.cmcontinue ?? "";
    if (!cmcontinue) break;
  }

  return titles.slice(0, limit);
}

async function wikipediaSummary(title: string): Promise<WikipediaSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT }
  });
  if (!response.ok) return null;
  const summary = await response.json();
  if (summary.type === "disambiguation" || summary.type === "no-extract") return null;
  return summary;
}

async function fetchWikidata(query: string): Promise<WikidataRow[]> {
  const response = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: {
      "accept": "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT
    },
    body: new URLSearchParams({ query })
  });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status} ${response.statusText}`);
  const json = await response.json();
  return json.results?.bindings ?? [];
}

function makeCard({ title, description, category, source = "generated" }: {
  title: string;
  description: string;
  category: ReviewCategoryId;
  source?: string;
}): CandidateCard | null {
  if (!title || !description) return null;
  if (title.length > 64 || description.length > 190) return null;
  if (isBlocked(title) || isBlocked(description)) return null;
  const normalized = normalizedTitle(title);
  if (generatedTitles.has(normalized)) return null;

  let id = `${category}-${slugify(title)}`;
  let suffix = 2;
  while (generatedIds.has(id)) {
    id = `${category}-${slugify(title)}-${suffix}`;
    suffix += 1;
  }

  generatedTitles.add(normalized);
  generatedIds.add(id);
  return {
    status: "KEEP",
    category,
    categoryLabel: CATEGORY_LABELS[category] ?? "Family Friendly",
    id,
    title,
    description,
    source
  };
}

function makeDescription(title: string, rawDescription: string, category: ReviewCategoryId): string {
  const cleaned = cleanDescription(rawDescription);
  if (cleaned) return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  const label = CATEGORY_LABELS[category] ?? "party game";
  return `A ${label.toLowerCase()} clue that should be recognizable and playable in Fish Bowl.`;
}

function cleanDescription(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^Wikimedia disambiguation page\.?$/i, "")
    .replace(/^category page\.?$/i, "")
    .trim()
    .slice(0, 185);
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+\(.+?\)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generatedSituationCards(wanted: number): CandidateCard[] {
  const roles = ["A chef", "A teacher", "A magician", "A robot", "A detective", "A pirate", "A superhero", "A movie star", "A vampire", "A time traveler", "A game show host", "A wedding planner", "A babysitter", "A taxi driver", "A lifeguard", "A substitute teacher", "A weather reporter", "A mall security guard", "A dentist", "A camp counselor", "A flight attendant", "A librarian", "A yoga instructor", "A dog walker", "A tour guide", "A barista", "A referee", "A news anchor", "A firefighter", "A crossing guard"];
  const scenarios = ["losing their keys", "trying to order lunch", "stuck in an elevator", "hosting a surprise party", "learning to dance", "shopping on Black Friday", "running a garage sale", "using a broken phone", "trying to park a car", "getting caught in the rain", "assembling furniture", "taking a school photo", "riding a roller coaster", "at airport security", "on a first date", "in a spelling bee", "at karaoke night", "at a silent disco", "at a talent show", "in an escape room", "trying yoga", "camping for the first time", "at a costume contest", "making a cooking video", "teaching a pet trick", "giving a dramatic apology", "waiting at the DMV", "ordering from a drive-thru", "trying to be sneaky", "finding a spider"];
  const cards: CandidateCard[] = [];
  for (const role of roles) {
    for (const scenario of scenarios) {
      if (cards.length >= wanted) return cards;
      const title = `${role} ${scenario}`.replace(/^A ([aeiou])/i, "An $1");
      const card = makeCard({
        title,
        category: "situations",
        description: `A funny situation where ${role.toLowerCase()} is ${scenario}.`,
        source: "generated-situation-template"
      });
      if (card) cards.push(card);
    }
  }
  return cards;
}

function generatedFamilyFriendlyCards(wanted: number): CandidateCard[] {
  const safeConcepts = [
    ...["Blue backpack", "Red lunchbox", "School bell", "Class pet", "Art class", "Recess", "Library card", "Book fair", "Science project", "Field day", "Bus driver", "Crossing guard", "Lost mitten", "Rain boots", "Snow angel", "Puddle jumping", "Sidewalk chalk", "Bubble bath", "Tooth fairy", "Bedtime story", "Pajama day", "Blanket fort", "Pillow mountain", "Stuffed animal parade", "LEGO tower", "Toy train", "Dollhouse", "Action figure", "Board game night", "Puzzle piece"],
    ...["Panda cub", "Baby elephant", "Sea turtle", "Clownfish", "Hermit crab", "Firefly", "Ladybug", "Caterpillar", "Dragonfly", "Bunny", "Puppy", "Kitten", "Goldfish", "Parrot", "Hedgehog", "Koala", "Kangaroo joey", "Otter", "Seal", "Polar bear", "Zebra", "Monkey", "Flamingo", "Peacock", "Owl", "Duckling", "Frog", "Tadpole", "Snail", "Starfish"],
    ...["Rainbow slide", "Swing set", "Monkey bars", "Sandbox", "Treehouse", "Kite flying", "Hopscotch", "Hide-and-seek", "Simon Says", "Musical chairs", "Freeze dance", "Treasure hunt", "Birthday candles", "Cupcake frosting", "Ice cream sundae", "Pizza slice", "Pancake stack", "Spaghetti noodles", "Popcorn bucket", "Lemonade stand", "Apple picking", "Pumpkin patch", "Beach bucket", "Sandcastle", "Snowman", "Water balloon", "Hula hoop", "Jump rope", "Scooter", "Training wheels"]
  ];
  const adjectives = ["Tiny", "Giant", "Silly", "Sleepy", "Dancing", "Rainbow", "Magic", "Wiggly", "Bouncy", "Friendly", "Sparkly", "Super", "Cozy", "Brave", "Happy", "Fluffy", "Noisy", "Gentle", "Shiny", "Round"];
  const nouns = ["robot", "dragon", "unicorn", "puppy", "penguin", "cupcake", "backpack", "kite", "crayon", "teddy bear", "rocket ship", "treehouse", "snowman", "sandcastle", "pancake", "bubble wand", "train", "storybook", "lunchbox", "playground", "dinosaur", "pirate ship", "rain cloud", "cookie", "balloon", "wagon", "blanket", "flashlight", "garden", "pencil"];
  const actions = ["building a fort", "making pancakes", "flying a kite", "reading a story", "looking for treasure", "walking to school", "playing pretend", "packing a lunch", "planting flowers", "feeding a pet", "making a card", "drawing a map", "riding a scooter", "cleaning up toys", "finding a lost sock"];
  const cards: CandidateCard[] = [];
  for (const concept of safeConcepts) {
    if (cards.length >= wanted) return cards;
      const card = makeCard({
        title: concept,
        category: "family_friendly",
        description: `A kid-friendly clue about ${withArticle(concept)}, easy to describe or act out.`,
        source: "generated-family-friendly-list"
      });
    if (card) cards.push(card);
  }
  for (const adjective of adjectives) {
    for (const noun of nouns) {
      if (cards.length >= wanted) return cards;
      const title = `${adjective} ${noun}`;
      const card = makeCard({
        title,
        category: "family_friendly",
        description: `A playful family-friendly clue: imagine a ${title.toLowerCase()} in action.`,
        source: "generated-family-friendly-template"
      });
      if (card) cards.push(card);
    }
  }
  for (const noun of nouns) {
    for (const action of actions) {
      if (cards.length >= wanted) return cards;
      const title = `${capitalize(noun)} ${action}`;
      const card = makeCard({
        title,
        category: "family_friendly",
        description: `A kid-friendly clue about ${withArticle(title)}, easy to describe or act out.`,
        source: "generated-family-friendly-action-template"
      });
      if (card) cards.push(card);
    }
  }
  return cards;
}

function generatedAnimalsNatureCards(wanted: number): CandidateCard[] {
  const groups = [
    {
      description: "A nature clue about this mammal, easy to describe with habitat, movement, or sounds.",
      items: ["Aardvark", "Alpaca", "Anteater", "Antelope", "Armadillo", "Baboon", "Badger", "Bat", "Beaver", "Bison", "Black bear", "Bobcat", "Camel", "Capybara", "Caribou", "Cheetah", "Chimpanzee", "Chipmunk", "Cougar", "Coyote", "Deer", "Dolphin", "Donkey", "Elephant", "Elk", "Ferret", "Fox", "Gazelle", "Giraffe", "Goat", "Gorilla", "Groundhog", "Hamster", "Hare", "Hedgehog", "Hippopotamus", "Horse", "Hyena", "Jaguar", "Kangaroo", "Koala", "Lemur", "Leopard", "Lion", "Llama", "Manatee", "Meerkat", "Mole", "Moose", "Mouse", "Narwhal", "Opossum", "Orangutan", "Otter", "Panda", "Panther", "Platypus", "Porcupine", "Prairie dog", "Raccoon", "Rat", "Reindeer", "Rhinoceros", "Sea lion", "Seal", "Sheep", "Skunk", "Sloth", "Squirrel", "Tiger", "Walrus", "Warthog", "Weasel", "Whale", "Wolf", "Wombat", "Yak", "Zebra"]
    },
    {
      description: "A bird clue that can be described by its shape, color, call, or flight.",
      items: ["Albatross", "Bald eagle", "Blue jay", "Canary", "Cardinal", "Chicken", "Cockatoo", "Crane", "Crow", "Duck", "Eagle", "Emu", "Falcon", "Finch", "Flamingo", "Goose", "Hawk", "Heron", "Hummingbird", "Kingfisher", "Kiwi", "Macaw", "Ostrich", "Owl", "Parakeet", "Parrot", "Peacock", "Pelican", "Penguin", "Pigeon", "Puffin", "Raven", "Roadrunner", "Robin", "Rooster", "Seagull", "Sparrow", "Stork", "Swan", "Toucan", "Turkey", "Vulture", "Woodpecker"]
    },
    {
      description: "A water-life clue about something that swims, floats, hides, or lives near water.",
      items: ["Angelfish", "Barracuda", "Clownfish", "Crab", "Crayfish", "Eel", "Goldfish", "Great white shark", "Hammerhead shark", "Hermit crab", "Jellyfish", "Koi fish", "Lobster", "Manta ray", "Octopus", "Oyster", "Pufferfish", "Salmon", "Sand dollar", "Seahorse", "Sea cucumber", "Sea turtle", "Sea urchin", "Shrimp", "Squid", "Starfish", "Stingray", "Swordfish", "Trout"]
    },
    {
      description: "A reptile or amphibian clue that can be acted out with movement, texture, or habitat.",
      items: ["Alligator", "Anaconda", "Boa constrictor", "Bullfrog", "Chameleon", "Cobra", "Crocodile", "Desert tortoise", "Frog", "Gecko", "Gila monster", "Iguana", "Komodo dragon", "Lizard", "Newt", "Poison dart frog", "Python", "Rattlesnake", "Salamander", "Sea snake", "Skink", "Snapping turtle", "Toad", "Tree frog", "Turtle"]
    },
    {
      description: "A small nature clue about bugs, pollinators, or tiny outdoor life.",
      items: ["Ant", "Aphid", "Bee", "Beetle", "Butterfly", "Caterpillar", "Centipede", "Cicada", "Cricket", "Dragonfly", "Firefly", "Flea", "Grasshopper", "Honeybee", "Ladybug", "Mantis", "Millipede", "Moth", "Praying mantis", "Scarab beetle", "Snail", "Spider", "Stick insect", "Termite", "Wasp", "Worm"]
    },
    {
      description: "A dinosaur or prehistoric clue with a memorable shape, size, or feature.",
      items: ["Allosaurus", "Ankylosaurus", "Apatosaurus", "Archaeopteryx", "Brachiosaurus", "Brontosaurus", "Dilophosaurus", "Diplodocus", "Iguanodon", "Megalodon", "Mosasaurus", "Pachycephalosaurus", "Parasaurolophus", "Plesiosaurus", "Pteranodon", "Spinosaurus", "Stegosaurus", "Triceratops", "Tyrannosaurus rex", "Velociraptor"]
    },
    {
      description: "A plant or fungus clue that can be described by shape, color, smell, or where it grows.",
      items: ["Acorn", "Aloe vera", "Bamboo", "Cactus", "Carnation", "Cherry blossom", "Clover", "Daisy", "Dandelion", "Fern", "Ivy", "Lavender", "Lily pad", "Maple leaf", "Marigold", "Mistletoe", "Moss", "Mushroom", "Oak tree", "Palm tree", "Pine tree", "Pinecone", "Poison ivy", "Pumpkin vine", "Redwood tree", "Rose", "Seaweed", "Sunflower", "Tulip", "Venus flytrap", "Vine", "Water lily", "Willow tree"]
    },
    {
      description: "A natural-world clue about weather, landforms, sky sights, or outdoor places.",
      items: ["Aurora", "Avalanche", "Bay", "Beach", "Blizzard", "Canyon", "Cave", "Cloud", "Coral reef", "Desert", "Dew", "Earthquake", "Fog", "Forest", "Geyser", "Glacier", "Grand Canyon", "Hail", "Hot spring", "Iceberg", "Island", "Lagoon", "Lake", "Lightning", "Meteor shower", "Moon crater", "Mountain", "Mudslide", "Oasis", "Ocean wave", "Pond", "Prairie", "Rainbow", "Rainstorm", "River", "Sand dune", "Savanna", "Snowflake", "Solar eclipse", "Swamp", "Thunderstorm", "Tide pool", "Tornado", "Valley", "Volcano", "Waterfall", "Whirlpool", "Windstorm"]
    }
  ];
  const cards: CandidateCard[] = [];
  for (const group of groups) {
    for (const title of group.items) {
      if (cards.length >= wanted) return cards;
      const card = makeCard({
        title,
        category: "animals_nature",
        description: group.description,
        source: "generated-animals-nature-list"
      });
      if (card) cards.push(card);
    }
  }

  const habitats = ["Arctic", "desert", "rainforest", "mountain", "ocean", "prairie", "swamp", "jungle", "river", "garden"];
  const natureNouns = ["fox", "owl", "snake", "frog", "butterfly", "flower", "tree", "storm", "fish", "lizard", "mushroom", "turtle", "hawk", "whale", "beetle"];
  for (const habitat of habitats) {
    for (const noun of natureNouns) {
      if (cards.length >= wanted) return cards;
      const title = `${capitalize(habitat)} ${noun}`;
      const card = makeCard({
        title,
        category: "animals_nature",
        description: `A nature clue about a ${title.toLowerCase()}, easy to describe with habitat, movement, or appearance.`,
        source: "generated-animals-nature-template"
      });
      if (card) cards.push(card);
    }
  }

  return cards;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function withArticle(value: string): string {
  return `${/^[aeiou]/i.test(value) ? "an" : "a"} ${value.toLowerCase()}`;
}

function generatedFallbackCards(category: PassPlayCategoryId, wanted: number): CandidateCard[] {
  if (category === "situations") return generatedSituationCards(wanted);
  if (category === "animals_nature") return generatedAnimalsNatureCards(wanted);
  const cards: CandidateCard[] = [];
  const label = CATEGORY_LABELS[category] ?? category;
  for (let index = 1; cards.length < wanted; index += 1) {
    const card = makeCard({
      title: `${label} Candidate ${index}`,
      category,
      description: `A review placeholder for ${label.toLowerCase()} candidate ${index}. Replace or delete during review.`,
      source: "generated-placeholder"
    });
    if (card) cards.push(card);
  }
  return cards;
}

function markdownForCategory(category: ReviewCategoryId, cards: CandidateCard[]): string {
  const label = CATEGORY_LABELS[category] ?? "Family Friendly";
  const targetLine = category === "family_friendly"
    ? `Target total: ${TARGET_FAMILY_FRIENDLY}. Current total: ${familyCurrentCount}. Candidate additions: ${cards.length}.`
    : `Target total: ${TARGET_PER_CATEGORY}. Current total: ${currentCounts.get(category) ?? 0}. Candidate additions: ${cards.length}.`;
  return `# ${label} Review

${targetLine}

How to review:
- Leave \`- [x] Keep\` checked for cards you like.
- Change to \`- [ ] Keep\` to remove a card.
- Edit \`Title:\`, \`Description:\`, or \`Category:\` directly if needed.

${cards.map(cardMarkdown).join("\n")}`;
}

function cardMarkdown(card: CandidateCard): string {
  return `## ${card.title}
- [x] Keep
Category: ${card.category}
Title: ${card.title}
Description: ${card.description}
Source: ${card.source}
`;
}

function reviewIndexMarkdown(candidatesByCategory: Record<ReviewCategoryId, CandidateCard[]>): string {
  const lines = [
    "# Target Fill Card Review",
    "",
    "Review one file at a time. To remove a card, change `- [x] Keep` to `- [ ] Keep`.",
    "",
    "| File | Current | Target | Candidates |",
    "|---|---:|---:|---:|"
  ];
  for (const category of REVIEW_CATEGORY_IDS) {
    const file = CATEGORY_FILES[category];
    const current = category === "family_friendly" ? familyCurrentCount : currentCounts.get(category) ?? 0;
    const target = category === "family_friendly" ? TARGET_FAMILY_FRIENDLY : TARGET_PER_CATEGORY;
    lines.push(`| ${file} | ${current} | ${target} | ${candidatesByCategory[category].length} |`);
  }
  lines.push("");
  lines.push("When review is done, tell Codex to apply the reviewed target-fill cards.");
  return `${lines.join("\n")}\n`;
}

function countBy<T, K>(items: T[], getKey: (item: T) => K): Map<K, number> {
  const map = new Map<K, number>();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/^the\s+/i, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isBlocked(value: string): boolean {
  return [
    /\bdeath\b/i,
    /\bmurder\b/i,
    /\bshooting\b/i,
    /\bmassacre\b/i,
    /\bgenocide\b/i,
    /\bterror/i,
    /\bsuicide\b/i,
    /\bpolitician\b/i,
    /\bdictator\b/i,
    /\bpresident\b/i,
    /\bprime minister\b/i,
    /\bsenator\b/i,
    /\bgovernor\b/i,
    /\bmayor\b/i,
    /\bmember of parliament\b/i,
    /\bpolitical\b/i,
    /\bactivist\b/i,
    /\bwar\b/i,
    /\bcrime\b/i,
    /\bscandal\b/i
  ].some((pattern) => pattern.test(value));
}
