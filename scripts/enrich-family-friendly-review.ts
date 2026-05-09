import fs from "node:fs";
import path from "node:path";

type ReviewCard = {
  keepLine: string;
  category: string;
  title: string;
  description: string;
  source: string;
};

type CandidateCard = {
  status: string;
  category: string;
  categoryLabel: string;
  id: string;
  title: string;
  description: string;
  source?: string;
};

const REVIEW_FILE = path.join("card-review", "target-fill", "family-friendly.md");
const CANDIDATES_FILE = path.join("card-review", "target-fill", "candidates.json");
const README_FILE = path.join("card-review", "target-fill", "README.md");

const REMOVE_PREFIXES = [
  "Tiny",
  "Giant",
  "Silly",
  "Sleepy",
  "Dancing",
  "Rainbow",
  "Magic",
  "Wiggly",
  "Bouncy",
  "Friendly",
  "Sparkly"
];

const ALLOWED_PREFIX_TITLES = new Set(["Silly String", "Bouncy Castle"]);

const DESCRIPTIONS: Record<string, string> = {
  Backpack: "A school bag with straps, zippers, pockets, and books or lunch packed inside.",
  Lunchbox: "A container for carrying a packed school lunch, snacks, or a sandwich.",
  "School bell": "The ringing sound that signals the start or end of class, recess, or the school day.",
  "Class pet": "A classroom animal students help feed and care for, often in a cage or tank.",
  "Art class": "A school class full of paint, crayons, paper, clay, and creative projects.",
  Recess: "A break during the school day when kids go outside or play games together.",
  "Library card": "A small card used to borrow books, movies, or other items from the library.",
  "Book fair": "A school event with tables or shelves full of books for kids to browse and buy.",
  "Science project": "A school experiment or display board explaining a question, test, and result.",
  "Field day": "A school day of outdoor games, races, relays, and team activities.",
  "Bus driver": "The person who drives students to and from school in a big yellow bus.",
  "Lost mitten": "One missing winter mitten that fell out of a pocket or disappeared on the playground.",
  "Rain boots": "Waterproof boots worn for splashing through puddles and walking in wet weather.",
  "Snow angel": "A shape made by lying in snow and moving arms and legs back and forth.",
  "Puddle jumping": "Splashing into puddles after rain, usually while wearing boots.",
  "Sidewalk chalk": "Colorful chalk used to draw pictures, games, or messages on pavement.",
  "Bubble bath": "A bath filled with foamy bubbles, warm water, and usually lots of silly shapes.",
  "Tooth fairy": "A pretend fairy who trades a lost baby tooth under a pillow for a small surprise.",
  "Bedtime story": "A book or tale read before sleep to help someone settle down for the night.",
  "Pajama day": "A school or camp day when everyone gets to wear pajamas instead of regular clothes.",
  "Pillow mountain": "A pile of pillows stacked up like a soft mountain for jumping, climbing, or lounging.",
  "Stuffed animal parade": "A pretend parade of plush toys lined up, marched around, or shown off.",
  "LEGO tower": "A tall stack or building made from LEGO bricks, usually trying not to tip over.",
  "Toy train": "A miniature train that rolls on tracks or across the floor during playtime.",
  Dollhouse: "A small toy house with tiny rooms, furniture, and characters for pretend play.",
  "Action figure": "A poseable toy character used for adventures, battles, or pretend stories.",
  "Board game night": "A family or group night spent playing tabletop games with pieces, cards, or dice.",
  "Puzzle piece": "One oddly shaped piece that fits with others to complete a picture.",
  "Panda cub": "A young panda with black-and-white fur, round ears, and a playful clumsy look.",
  "Baby elephant": "A young elephant with big ears, a small trunk, and wobbly steps.",
  Bunny: "A small rabbit with long ears, soft fur, and a hopping walk.",
  Puppy: "A young dog that loves playing, wagging, chewing, and following people around.",
  Kitten: "A young cat with tiny paws, soft fur, and playful pouncing energy.",
  "Kangaroo joey": "A baby kangaroo that rides in its mother's pouch before hopping on its own.",
  "Polar bear": "A large white bear from icy Arctic regions, known for swimming and thick fur.",
  Monkey: "A playful primate that climbs, swings, grabs food, and uses expressive faces.",
  Duckling: "A fluffy baby duck that waddles after its mother and peeps near water.",
  Tadpole: "A baby frog or toad that swims with a tail before growing legs.",
  "Swing set": "A playground frame with hanging swings for pumping legs and flying back and forth.",
  "Monkey bars": "A playground ladder of overhead bars kids cross by swinging hand to hand.",
  Sandbox: "A play area filled with sand for digging, scooping, and building castles.",
  "Kite flying": "Holding a string while a kite catches the wind and soars in the sky.",
  Hopscotch: "A sidewalk jumping game played by hopping through numbered squares.",
  "Simon Says": "A listening game where players copy commands only when they begin with Simon says.",
  "Freeze dance": "A music game where everyone dances until the music stops, then freezes in place.",
  "Treasure hunt": "A search game where clues lead players toward a hidden prize or surprise.",
  "Birthday candles": "Candles on a birthday cake that are lit, wished on, and blown out.",
  "Cupcake frosting": "The sweet icing swirled or spread on top of a cupcake.",
  "Ice cream sundae": "A dessert with ice cream topped with syrup, whipped cream, sprinkles, or a cherry.",
  "Pizza slice": "A triangular piece of pizza with crust, sauce, cheese, and toppings.",
  "Pancake stack": "A pile of pancakes often topped with butter, syrup, fruit, or whipped cream.",
  "Spaghetti noodles": "Long pasta noodles that twist around a fork and often come with sauce.",
  "Popcorn bucket": "A container full of popped corn, often shared during a movie.",
  "Lemonade stand": "A small homemade stand where kids pretend to sell or actually sell lemonade.",
  "Apple picking": "Visiting an orchard to choose apples straight from the trees.",
  "Pumpkin patch": "A field or farm area where people pick pumpkins, often in the fall.",
  "Beach bucket": "A small plastic bucket used for carrying sand, shells, or water at the beach.",
  Sandcastle: "A castle shape made from wet sand, usually with towers, walls, and a moat.",
  Snowman: "A figure built from stacked snowballs, often with a face, scarf, and stick arms.",
  "Water balloon": "A small balloon filled with water for outdoor games and splashy throws.",
  "Hula hoop": "A plastic ring spun around the waist, arms, or legs as a game or trick.",
  "Jump rope": "A rope swung under the feet and over the head while someone jumps in rhythm.",
  Scooter: "A small ride-on board with handlebars that moves when a rider kicks the ground.",
  "Training wheels": "Small side wheels on a bicycle that help a beginner balance while learning.",
  "Silly String": "A colorful party foam sprayed from a can in long, messy, string-like streamers.",
  "Bouncy Castle": "An inflatable play structure kids jump inside, often shaped like a castle."
};

main();

function main() {
  const markdown = fs.readFileSync(REVIEW_FILE, "utf8");
  const { header, cards } = parseReviewMarkdown(markdown);
  const filteredCards = cards.filter((card) => !shouldRemove(card.title));
  addCardIfMissing(filteredCards, "Silly String");
  addCardIfMissing(filteredCards, "Bouncy Castle");

  for (const card of filteredCards) {
    if (card.title === "Blue backpack") card.title = "Backpack";
    if (card.title === "Red lunchbox") card.title = "Lunchbox";
    const description = DESCRIPTIONS[card.title];
    if (description) {
      card.description = description;
      card.source = card.source.startsWith("generated-") ? "curated-description" : card.source;
    }
  }

  fs.writeFileSync(REVIEW_FILE, renderReviewMarkdown(header, filteredCards));
  updateCandidatesJson(filteredCards);
  updateReadme(filteredCards.length);

  console.log(`Family Friendly cards: ${cards.length} -> ${filteredCards.length}`);
  console.log(`Removed generic prefix cards: ${cards.length - filteredCards.length}`);
}

function parseReviewMarkdown(markdown: string) {
  const firstCard = markdown.indexOf("\n## ");
  const header = markdown.slice(0, firstCard).trimEnd();
  const body = markdown.slice(firstCard).trim();
  const cards = body.split(/\n(?=## )/g).filter(Boolean).map(parseCardBlock);
  return { header, cards };
}

function parseCardBlock(block: string): ReviewCard {
  const lines = block.split("\n");
  return {
    keepLine: lines.find((line) => /^- \[[ x]\] Keep$/.test(line)) ?? "- [x] Keep",
    category: readField(lines, "Category") || "family_friendly",
    title: readField(lines, "Title") || lines[0].replace(/^##\s+/, "").trim(),
    description: readField(lines, "Description"),
    source: readField(lines, "Source")
  };
}

function readField(lines: string[], field: string) {
  return lines.find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2).trim() ?? "";
}

function shouldRemove(title: string) {
  if (ALLOWED_PREFIX_TITLES.has(title)) return false;
  return REMOVE_PREFIXES.some((prefix) => title.startsWith(`${prefix} `));
}

function addCardIfMissing(cards: ReviewCard[], title: string) {
  if (cards.some((card) => card.title === title)) return;
  cards.push({
    keepLine: "- [x] Keep",
    category: "family_friendly",
    title,
    description: DESCRIPTIONS[title],
    source: "curated-description"
  });
}

function renderReviewMarkdown(header: string, cards: ReviewCard[]) {
  const updatedHeader = header.replace(/Candidate additions: \d+\./, `Candidate additions: ${cards.length}.`);
  return `${updatedHeader}\n\n${cards.map(renderCard).join("\n")}`;
}

function renderCard(card: ReviewCard) {
  return `## ${card.title}
${card.keepLine}
Category: ${card.category}
Title: ${card.title}
Description: ${card.description}
Source: ${card.source}
`;
}

function updateCandidatesJson(cards: ReviewCard[]) {
  if (!fs.existsSync(CANDIDATES_FILE)) return;
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8")) as CandidateCard[];
  const familyCards = new Map(cards.map((card) => [card.title, card]));
  const nextCandidates = candidates
    .filter((candidate) => candidate.category !== "family_friendly" || familyCards.has(candidate.title))
    .map((candidate) => {
      if (candidate.category !== "family_friendly") return candidate;
      const reviewedCard = familyCards.get(candidate.title);
      if (!reviewedCard) return candidate;
      return {
        ...candidate,
        status: reviewedCard.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
        description: reviewedCard.description,
        source: reviewedCard.source
      };
    });

  for (const card of cards) {
    if (nextCandidates.some((candidate) => candidate.category === "family_friendly" && candidate.title === card.title)) continue;
    nextCandidates.push({
      status: card.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
      category: "family_friendly",
      categoryLabel: "Family Friendly",
      id: `family_friendly-${slugify(card.title)}`,
      title: card.title,
      description: card.description,
      source: card.source
    });
  }

  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
}

function updateReadme(familyCount: number) {
  if (!fs.existsSync(README_FILE)) return;
  const markdown = fs.readFileSync(README_FILE, "utf8");
  fs.writeFileSync(README_FILE, markdown.replace(/(\| family-friendly\.md \| 69 \| 440 \| )\d+(\s*\|)/, `$1${familyCount}$2`));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
