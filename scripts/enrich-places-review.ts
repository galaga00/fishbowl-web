import fs from "node:fs";
import path from "node:path";

type ReviewCard = {
  block: string;
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

const REVIEW_FILE = path.join("card-review", "target-fill", "places-things.md");
const CANDIDATES_FILE = path.join("card-review", "target-fill", "candidates.json");
const README_FILE = path.join("card-review", "target-fill", "README.md");

const KEEP_TITLES = new Set([
  "London",
  "Vatican City",
  "Singapore",
  "New York City",
  "Beijing",
  "Hong Kong",
  "Jerusalem",
  "Helsinki",
  "Warsaw",
  "Amsterdam",
  "Stockholm",
  "Ho Chi Minh City",
  "Bangkok",
  "Sydney",
  "Mexico City",
  "São Paulo",
  "Seoul",
  "Barcelona",
  "Copenhagen",
  "Mecca",
  "Venice",
  "Milan",
  "Mumbai",
  "Brasília",
  "Gibraltar",
  "Toronto",
  "Dubai",
  "Lima",
  "Havana",
  "Reykjavík",
  "Kuala Lumpur",
  "Canberra",
  "Naples",
  "airplane",
  "Taipei",
  "Kathmandu",
  "Tel Aviv",
  "Edinburgh",
  "Lagos",
  "Johannesburg",
  "Abu Dhabi",
  "Manchester",
  "The Hague",
  "Mount Kilimanjaro",
  "Liverpool",
  "Alexandria",
  "Luxembourg",
  "Glasgow",
  "Perth",
  "Bethlehem",
  "Birmingham",
  "Brisbane",
  "Belfast",
  "Cardiff",
  "Kingston",
  "Auckland",
  "Panama City",
  "Pisa",
  "Santo Domingo",
  "Toyota",
  "San José",
  "Oxford",
  "Hagia Sophia",
  "Cambridge",
  "Calgary",
  "Mount Fuji",
  "oil",
  "Nassau",
  "San Marino",
  "Verona",
  "Berlin Wall",
  "Angkor Wat",
  "Shenzhen",
  "Lhasa",
  "Varanasi",
  "Mount Vesuvius",
  "Galapagos Islands",
  "Nazareth",
  "Parthenon",
  "Cannes",
  "St. Peter's Basilica",
  "Siena",
  "Timbuktu",
  "Cheyenne",
  "York",
  "Constantinople",
  "Fez",
  "Notre-Dame de Paris",
  "Empire State Building",
  "Mount Etna",
  "Great Pyramid of Giza",
  "Nottingham",
  "Bruges",
  "Yellowstone National Park",
  "Petra",
  "Giza",
  "Cusco",
  "Bath",
  "Chichen Itza",
  "Al-Masjid Al-Haram"
]);

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  airplane: "A powered flying vehicle with wings, engines, rows of seats, and airport travel associations.",
  oil: "A slippery liquid associated with cooking, engines, fuel, and things that need lubrication.",
  Toyota: "A Japanese car brand known for everyday vehicles like the Camry, Corolla, Prius, and trucks.",
  "Al-Masjid Al-Haram": "The Great Mosque of Mecca, Islam's holiest mosque and the site surrounding the Kaaba."
};

main();

function main() {
  const markdown = fs.readFileSync(REVIEW_FILE, "utf8");
  const { header, cards } = parseReviewMarkdown(markdown);
  const keptCards = cards
    .filter((card) => !hasDeleteMarker(card.block))
    .filter((card) => KEEP_TITLES.has(normalizeSpacing(card.title)))
    .map((card) => ({
      ...card,
      description: DESCRIPTION_OVERRIDES[normalizeSpacing(card.title)] ?? card.description,
      source: DESCRIPTION_OVERRIDES[normalizeSpacing(card.title)] ? "curated-description" : card.source
    }));

  fs.writeFileSync(REVIEW_FILE, renderReviewMarkdown(header, keptCards));
  updateCandidatesJson(keptCards);
  updateReadme(keptCards.length);

  console.log(`Places & Things cards: ${cards.length} -> ${keptCards.length}`);
  console.log(`Removed obscure/delete cards: ${cards.length - keptCards.length}`);
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
    block,
    keepLine: lines.find((line) => /^- \[[ x]\] (Keep|Delete)$/i.test(line)) ?? "- [x] Keep",
    category: readField(lines, "Category") || "places_objects",
    title: readField(lines, "Title") || lines[0].replace(/^##\s+/, "").trim(),
    description: readField(lines, "Description"),
    source: readField(lines, "Source")
  };
}

function readField(lines: string[], field: string) {
  return lines.find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2).trim() ?? "";
}

function hasDeleteMarker(block: string) {
  return /\bdelete\b/i.test(block);
}

function renderReviewMarkdown(header: string, cards: ReviewCard[]) {
  const updatedHeader = header.replace(/Candidate additions: \d+\./, `Candidate additions: ${cards.length}.`);
  return `${updatedHeader}\n\n${cards.map(renderCard).join("\n")}`;
}

function renderCard(card: ReviewCard) {
  return `## ${normalizeSpacing(card.title)}
${card.keepLine}
Category: ${card.category}
Title: ${normalizeSpacing(card.title)}
Description: ${card.description}
Source: ${card.source}
`;
}

function updateCandidatesJson(cards: ReviewCard[]) {
  if (!fs.existsSync(CANDIDATES_FILE)) return;
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8")) as CandidateCard[];
  const nextCandidates = candidates.filter((candidate) => candidate.category !== "places_objects");
  nextCandidates.push(
    ...cards.map((card) => ({
      status: card.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
      category: "places_objects",
      categoryLabel: "Places & Things",
      id: `places_objects-${slugify(card.title)}`,
      title: normalizeSpacing(card.title),
      description: card.description,
      source: card.source
    }))
  );
  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
}

function updateReadme(count: number) {
  if (!fs.existsSync(README_FILE)) return;
  const markdown = fs.readFileSync(README_FILE, "utf8");
  fs.writeFileSync(README_FILE, markdown.replace(/(\| places-things\.md \| 59 \| 440 \| )\d+(\s*\|)/, `$1${count}$2`));
}

function normalizeSpacing(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
