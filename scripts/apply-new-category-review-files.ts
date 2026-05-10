import fs from "node:fs";
import path from "node:path";

type CandidateCard = {
  status: "KEEP" | "REMOVE";
  category: string;
  categoryLabel: string;
  id: string;
  title: string;
  description: string;
  source?: string;
};

type ReviewCard = {
  keepLine: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  source: string;
};

const REVIEW_DIR = path.join("card-review", "target-fill");
const CANDIDATES_FILE = path.join(REVIEW_DIR, "candidates.json");

const REVIEW_FILES = [
  { file: "food-drink.md", label: "Food & Drink" },
  { file: "sports.md", label: "Sports" },
  { file: "science-tech.md", label: "Science & Tech" },
  { file: "jobs-hobbies.md", label: "Jobs & Hobbies" },
  { file: "internet-memes.md", label: "Internet & Memes" }
];

main();

function main() {
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8")) as CandidateCard[];
  const reviewCards = REVIEW_FILES.flatMap(({ file, label }) => parseReviewFile(file, label));
  const romanEmpire = parseReviewFile("places-things.md", "Places & Things").find((card) => normalizeTitle(card.title) === "roman empire");
  if (romanEmpire) reviewCards.push(romanEmpire);

  const managedCategories = new Set(REVIEW_FILES.map(({ file }) => categoryFromFile(file)));
  const nextCandidates = candidates.filter((candidate) => !managedCategories.has(candidate.category));
  const byTitleAndCategory = new Set(nextCandidates.map((candidate) => keyFor(candidate.category, candidate.title)));

  for (const card of reviewCards) {
    const key = keyFor(card.category, card.title);
    const candidate: CandidateCard = {
      status: card.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
      category: card.category,
      categoryLabel: card.categoryLabel,
      id: `${card.category}-${slugify(card.title)}`,
      title: card.title,
      description: card.description,
      source: card.source
    };

    const existingIndex = nextCandidates.findIndex((existing) => keyFor(existing.category, existing.title) === key);
    if (existingIndex >= 0) {
      nextCandidates[existingIndex] = { ...nextCandidates[existingIndex], ...candidate };
      continue;
    }
    if (byTitleAndCategory.has(key)) continue;
    byTitleAndCategory.add(key);
    nextCandidates.push(candidate);
  }

  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
  console.log(`Merged ${reviewCards.filter((card) => card.keepLine.includes("[x]")).length} kept new-category review cards.`);
  console.log(`Wrote ${nextCandidates.length} candidates to ${CANDIDATES_FILE}.`);
}

function parseReviewFile(file: string, fallbackLabel: string): ReviewCard[] {
  const markdown = fs.readFileSync(path.join(REVIEW_DIR, file), "utf8");
  return markdown
    .split(/\n(?=## )/g)
    .filter((block) => block.startsWith("## "))
    .map((block) => parseCardBlock(block, fallbackLabel))
    .filter((card) => !/\bdelete\b/i.test(card.keepLine));
}

function parseCardBlock(block: string, fallbackLabel: string): ReviewCard {
  const lines = block.split("\n");
  return {
    keepLine: lines.find((line) => /^- \[[ x]\] (Keep|Delete)$/i.test(line)) ?? "- [x] Keep",
    category: readField(lines, "Category"),
    categoryLabel: fallbackLabel,
    title: readField(lines, "Title") || lines[0].replace(/^##\s+/, "").trim(),
    description: readField(lines, "Description"),
    source: readField(lines, "Source")
  };
}

function readField(lines: string[], field: string) {
  return lines.find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2).trim() ?? "";
}

function categoryFromFile(file: string) {
  return file.replace(/\.md$/, "").replace(/-/g, "_");
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function keyFor(category: string, title: string) {
  return `${category}:${normalizeTitle(title)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}
