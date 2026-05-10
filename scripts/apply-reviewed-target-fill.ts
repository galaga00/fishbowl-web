import fs from "node:fs";
import path from "node:path";
import { STARTER_DECK } from "../lib/starter-deck";
import type { StarterDeckCard } from "../lib/starter-deck";

type ReviewCandidate = {
  category: string;
  title: string;
  description: string;
  status?: string;
};

const REVIEW_FILE = path.join("card-review", "target-fill", "candidates.json");
const OUTPUT_FILE = path.join("lib", "target-fill-deck.ts");

const FAMILY_CATEGORY = "family_friendly";

const rawCandidates = JSON.parse(fs.readFileSync(REVIEW_FILE, "utf8")) as ReviewCandidate[];

const existingTitles = new Set(
  STARTER_DECK
    .filter((card) => !card.id.startsWith("target-fill-"))
    .map((card) => normalizeTitle(card.title))
);

const usedTitles = new Set(existingTitles);
const usedIds = new Set(
  STARTER_DECK
    .filter((card) => !card.id.startsWith("target-fill-"))
    .map((card) => card.id)
);

const deck: StarterDeckCard[] = [];
const familyCardIds: string[] = [];
const skippedDuplicates: string[] = [];

for (const candidate of rawCandidates) {
  if ((candidate.status ?? "KEEP").toUpperCase() !== "KEEP") continue;

  const normalized = normalizeTitle(candidate.title);
  if (usedTitles.has(normalized)) {
    skippedDuplicates.push(candidate.title);
    continue;
  }

  const isFamilyCard = candidate.category === FAMILY_CATEGORY;
  const idPrefix = isFamilyCard ? "target-fill-family-friendly" : `target-fill-${candidate.category}`;
  const id = uniqueId(`${idPrefix}-${slugify(candidate.title)}`, usedIds);
  const category = isFamilyCard ? inferFamilyCategory(candidate) : candidate.category;

  usedTitles.add(normalized);
  usedIds.add(id);

  deck.push({
    id,
    title: candidate.title,
    description: candidate.description,
    category
  });

  if (isFamilyCard) {
    familyCardIds.push(id);
  }
}

const output = `import type { StarterDeckCard } from "./starter-deck";

// Generated from card-review/target-fill/candidates.json.
// Re-run "npx tsx scripts/apply-reviewed-target-fill.ts" after editing review Markdown.
export const TARGET_FILL_DECK: StarterDeckCard[] = ${JSON.stringify(deck, null, 2)};

export const TARGET_FILL_FAMILY_CARD_IDS = new Set(${JSON.stringify(familyCardIds, null, 2)});
`;

fs.writeFileSync(OUTPUT_FILE, `${output}\n`);

console.log(`Wrote ${deck.length} cards to ${OUTPUT_FILE}`);
console.log(`Family-friendly additions: ${familyCardIds.length}`);
console.log(`Skipped duplicate titles already in the deck: ${skippedDuplicates.length}`);
if (skippedDuplicates.length > 0) {
  console.log(skippedDuplicates.slice(0, 30).join("\n"));
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function uniqueId(baseId: string, used: Set<string>) {
  let id = baseId;
  let suffix = 2;
  while (used.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function inferFamilyCategory(candidate: ReviewCandidate) {
  const text = `${candidate.title} ${candidate.description}`.toLowerCase();

  if (/\b(animal|bear|bunny|cat|cow|dog|duck|elephant|fish|frog|horse|kangaroo|kitten|lion|monkey|panda|penguin|puppy|tiger|turtle|zebra)\b/.test(text)) {
    return "animals_nature";
  }

  if (/\b(actor|artist|chef|coach|dentist|doctor|driver|fairy|friend|grandma|grandpa|neighbor|nurse|pilot|teacher)\b/.test(text)) {
    return "people";
  }

  if (/\b(dance|game|hide and seek|hopscotch|jump|parade|party|play|race|sing|sleepover|tag|talent show|treasure hunt)\b/.test(text)) {
    return "places_objects";
  }

  return "places_objects";
}
