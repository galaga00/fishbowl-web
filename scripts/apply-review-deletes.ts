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

const REVIEW_DIR = path.join("card-review", "target-fill");
const CANDIDATES_FILE = path.join(REVIEW_DIR, "candidates.json");
const README_FILE = path.join(REVIEW_DIR, "README.md");

const CONFIG = {
  music: {
    file: "music.md",
    category: "music",
    readmeFile: "music.md"
  },
  people: {
    file: "people.md",
    category: "people",
    readmeFile: "people.md"
  }
};

main();

function main() {
  const key = process.argv[2] as keyof typeof CONFIG | undefined;
  if (!key || !CONFIG[key]) {
    console.error(`Usage: npx tsx scripts/apply-review-deletes.ts ${Object.keys(CONFIG).join("|")}`);
    process.exitCode = 1;
    return;
  }

  const config = CONFIG[key];
  const reviewPath = path.join(REVIEW_DIR, config.file);
  const markdown = fs.readFileSync(reviewPath, "utf8");
  const { header, cards } = parseReviewMarkdown(markdown);
  const keptCards = cards.filter((card) => !hasDeleteMarker(card.block));

  fs.writeFileSync(reviewPath, renderReviewMarkdown(header, keptCards));
  updateCandidatesJson(config.category, keptCards);
  updateReadme(config.readmeFile, keptCards.length);

  console.log(`${config.file}: ${cards.length} -> ${keptCards.length}`);
  console.log(`Removed DELETE blocks: ${cards.length - keptCards.length}`);
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
    category: readField(lines, "Category"),
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

function updateCandidatesJson(category: string, cards: ReviewCard[]) {
  if (!fs.existsSync(CANDIDATES_FILE)) return;
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8")) as CandidateCard[];
  const nextCandidates = candidates.filter((candidate) => candidate.category !== category);
  nextCandidates.push(
    ...cards.map((card) => ({
      status: card.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
      category,
      categoryLabel: labelForCategory(category),
      id: `${category}-${slugify(card.title)}`,
      title: normalizeSpacing(card.title),
      description: card.description,
      source: card.source
    }))
  );
  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
}

function updateReadme(file: string, count: number) {
  if (!fs.existsSync(README_FILE)) return;
  const markdown = fs.readFileSync(README_FILE, "utf8");
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  fs.writeFileSync(README_FILE, markdown.replace(new RegExp(`(\\| ${escaped} \\| \\d+ \\| 440 \\| )\\d+(\\s*\\|)`), `$1${count}$2`));
}

function labelForCategory(category: string) {
  if (category === "people") return "People & Celebrities";
  if (category === "music") return "Music";
  return category;
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
