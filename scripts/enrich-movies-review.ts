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

const REVIEW_FILE = path.join("card-review", "target-fill", "movies-tv.md");
const CANDIDATES_FILE = path.join("card-review", "target-fill", "candidates.json");
const README_FILE = path.join("card-review", "target-fill", "README.md");

const Q_RENAMES: Record<string, { title: string; description: string }> = {
  Q134773: {
    title: "Forrest Gump",
    description: "A Tom Hanks movie about a kind man who stumbles through major moments in American history."
  },
  Q79784: {
    title: "Friends",
    description: "A sitcom about six friends in New York, known for Central Perk, apartments, dating, and catchphrases."
  }
};

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  "Game of Thrones": "A fantasy TV series about rival noble families, dragons, battles, and the fight for the Iron Throne.",
  "Liv and Maddie": "A Disney Channel comedy about identical twin sisters with very different personalities.",
  "The Big Bang Theory": "A sitcom about nerdy physicists, geek culture, roommate rules, and awkward friendships.",
  "Squid Game": "A South Korean thriller about deadly childhood games, masked guards, and desperate contestants.",
  Teletubbies: "A children's TV show about colorful characters with belly screens, baby-sun giggles, and simple play.",
  "Doctor Who": "A British sci-fi series about a time-traveling Doctor, the TARDIS, aliens, and regenerations.",
  "Gone with the Wind": "An epic Civil War-era romance known for Scarlett O'Hara, Rhett Butler, and sweeping melodrama.",
  "Star Wars: Episode IV – A New Hope": "The original Star Wars film with Luke, Leia, Han, Darth Vader, lightsabers, and the Death Star.",
  "The Lord of the Rings: The Fellowship of the Ring": "A fantasy adventure where Frodo begins the quest to destroy the One Ring.",
  "Sesame Street": "A children's show with Big Bird, Elmo, Cookie Monster, songs, counting, and lessons on a city street.",
  Braveheart: "A historical epic about William Wallace, Scottish rebellion, battle speeches, and blue face paint.",
  Lost: "A mystery TV series about plane crash survivors, a strange island, flashbacks, and unanswered questions.",
  "House M.D.": "A medical drama about a brilliant, sarcastic doctor solving unusual cases with a cane and attitude.",
  "Prison Break": "A thriller series about an elaborate prison escape plan tattooed onto a brother's body.",
  "How I Met Your Mother": "A sitcom about friends, dating stories, Ted's narration, and the mystery of meeting the mother.",
  "The X-Files": "A sci-fi mystery series about FBI agents investigating aliens, monsters, and paranormal cases.",
  "Slumdog Millionaire": "A drama about a Mumbai contestant whose life experiences help him answer game show questions.",
  "Pirates of the Caribbean: The Curse of the Black Pearl": "A pirate adventure with Jack Sparrow, cursed treasure, sword fights, and a ghostly ship.",
  "A Beautiful Mind": "A biographical drama about mathematician John Nash, genius, delusions, and recovery.",
  "The Walking Dead": "A zombie survival series about walkers, ruined communities, and tense survivor groups.",
  "Brokeback Mountain": "A romantic drama about two cowboys whose relationship spans years of secrecy and longing.",
  "Star Wars: Episode V – The Empire Strikes Back": "The Star Wars film with Hoth, Yoda training, Cloud City, and Darth Vader's famous reveal.",
  "Citizen Kane": "A classic film about a newspaper tycoon, power, memory, and the mystery of Rosebud.",
  "The Office": "A workplace mockumentary sitcom about Dunder Mifflin, awkward meetings, pranks, and office romance.",
  "Xena: Warrior Princess": "A fantasy adventure series about a warrior hero, chakram throws, and mythic battles.",
  "Home Alone": "A holiday comedy where Kevin rigs traps to defend his house from bumbling burglars.",
  "Star Wars: Episode VI – Return of the Jedi": "The Star Wars film with Ewoks, Jabba's palace, Luke facing Vader, and the second Death Star.",
  "Some Like It Hot": "A classic comedy about two musicians hiding in an all-female band after witnessing a crime.",
  "Mr Bean": "A mostly silent comedy series about an awkward man causing chaos with strange solutions.",
  "Star Trek": "A sci-fi series about the starship Enterprise, space exploration, aliens, and boldly going.",
  "Monty Python's Life of Brian": "A British comedy that satirizes biblical epics, mistaken messiahs, and crowd behavior.",
  "Die Hard": "An action movie about John McClane fighting terrorists in a Los Angeles skyscraper on Christmas Eve.",
  "Lawrence of Arabia": "A sweeping desert epic about T. E. Lawrence, war, identity, and vast cinematic landscapes.",
  "12 Angry Men": "A courtroom drama about jurors arguing through doubt, evidence, bias, and one man's persistence.",
  "Dr. No": "The first James Bond film, with spy gadgets, island danger, and 007 facing a mysterious villain.",
  "12 Years a Slave": "A historical drama about Solomon Northup's kidnapping, enslavement, and fight to return home.",
  "Star Wars: Episode VII – The Force Awakens": "A Star Wars sequel with Rey, Finn, Kylo Ren, BB-8, and a new desert-to-space adventure.",
  Troy: "A sword-and-sandals epic about Achilles, Helen, Hector, and the Trojan War.",
  Amélie: "A whimsical French film about a shy Parisian woman secretly improving other people's lives.",
  "The Godfather Part III": "The final Godfather film about Michael Corleone trying to legitimize the family business.",
  Seven: "A dark crime thriller about detectives hunting a killer themed around the seven deadly sins.",
  "The Artist": "A mostly silent black-and-white film about a movie star struggling as talkies take over.",
  Birdman: "A dark comedy about a washed-up superhero actor staging a Broadway comeback.",
  "Shakespeare in Love": "A romantic comedy imagining Shakespeare finding inspiration while writing Romeo and Juliet.",
  Rocky: "A boxing drama about an underdog fighter training hard for a shot at the heavyweight champion.",
  "Rain Man": "A road drama about two brothers, autism, counting cards, and an unexpected bond.",
  "The Mummy": "An adventure horror film with ancient curses, desert tombs, scarab beetles, and a resurrected mummy.",
  "Million Dollar Baby": "A boxing drama about a determined fighter, a gruff trainer, and a devastating choice.",
  "The Bridge on the River Kwai": "A war film about prisoners building a bridge while pride and duty collide.",
  Amadeus: "A lavish drama about Mozart, Salieri, jealousy, genius, and classical music.",
  "Casino Royale": "A James Bond reboot with poker, parkour, betrayal, and Daniel Craig's first turn as 007.",
  "Battleship Potemkin": "A silent Soviet film famous for the Odessa Steps sequence and revolutionary imagery.",
  "The Sound of Music": "A musical about Maria, the von Trapp children, singing, mountains, and escaping the Nazis.",
  "The English Patient": "A romantic war drama about memory, a desert affair, and a badly burned patient.",
  "My Neighbor Totoro": "A Studio Ghibli film with forest spirits, two sisters, a catbus, and gentle childhood wonder.",
  "Independence Day": "A disaster action movie about alien invasion, huge explosions, and a presidential fighter pilot speech.",
  "Indiana Jones and the Temple of Doom": "An Indiana Jones adventure with mine carts, a cursed temple, and a glowing stone.",
  Spectre: "A James Bond film about a shadowy organization, global surveillance, and Bond's past.",
  "Hannah Montana": "A Disney Channel series about a teen secretly living a double life as a pop star.",
  "Dances with Wolves": "A western drama about a Union officer who bonds with a Lakota community on the frontier.",
  "Roman Holiday": "A romantic comedy about a runaway princess exploring Rome with a reporter.",
  "Quantum of Solace": "A James Bond film about revenge, secret organizations, and high-speed action after Casino Royale.",
  "The Hurt Locker": "A tense war drama about a bomb disposal team working under extreme pressure in Iraq.",
  "Love Actually": "A holiday ensemble romantic comedy about intersecting love stories around Christmas.",
  Aliens: "A sci-fi action sequel where Ripley and marines fight xenomorphs on a colony world.",
  "Lost in Translation": "A quiet drama about two lonely Americans forming a connection in Tokyo."
  ,
  "The Da Vinci Code": "A mystery thriller about secret symbols, religious conspiracies, and a race through famous European landmarks.",
  "E.T. the Extra-Terrestrial": "A Spielberg movie about a stranded alien, a boy named Elliott, glowing fingers, and phoning home.",
  GoldenEye: "A James Bond film with Pierce Brosnan, a stolen satellite weapon, and the famous N64 game tie-in.",
  "All About Eve": "A classic backstage drama about ambition, theater, betrayal, and an aging Broadway star.",
  Gandhi: "A biographical film about Mahatma Gandhi's nonviolent resistance and India's fight for independence.",
  "Gangs of New York": "A Martin Scorsese film about rival gangs, revenge, and political violence in 1800s New York.",
  Transformers: "A blockbuster about giant robots that change into vehicles, led by Autobots and Decepticons."
};

main();

function main() {
  const markdown = fs.readFileSync(REVIEW_FILE, "utf8");
  const { header, cards } = parseReviewMarkdown(markdown);
  const filteredCards: ReviewCard[] = [];
  const seenTitles = new Set<string>();

  for (const card of cards) {
    if (isDeleteMarker(card.keepLine)) continue;
    const qId = card.title.match(/^Q\d+$/)?.[0];
    if (qId && Q_RENAMES[qId]) {
      card.title = Q_RENAMES[qId].title;
      card.description = Q_RENAMES[qId].description;
      card.source = `http://www.wikidata.org/entity/${qId}`;
    }
    card.description = improveDescription(card.title, card.description);
    if (DESCRIPTION_OVERRIDES[normalizeSpacing(card.title)]) card.source = "curated-description";
    const key = normalizeTitle(card.title);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    filteredCards.push(card);
  }

  fs.writeFileSync(REVIEW_FILE, renderReviewMarkdown(header, filteredCards));
  updateCandidatesJson(filteredCards);
  updateReadme(filteredCards.length);

  console.log(`Movies & TV cards: ${cards.length} -> ${filteredCards.length}`);
  console.log(`Removed delete/duplicate cards: ${cards.length - filteredCards.length}`);
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
    keepLine: lines.find((line) => /^- \[[ x]\] (Keep|Delete)$/i.test(line)) ?? "- [x] Keep",
    category: readField(lines, "Category") || "movies",
    title: readField(lines, "Title") || lines[0].replace(/^##\s+/, "").trim(),
    description: readField(lines, "Description"),
    source: readField(lines, "Source")
  };
}

function readField(lines: string[], field: string) {
  return lines.find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2).trim() ?? "";
}

function isDeleteMarker(keepLine: string) {
  return /\bdelete\b/i.test(keepLine);
}

function improveDescription(title: string, description: string) {
  const cleanTitle = normalizeSpacing(title);
  const override = DESCRIPTION_OVERRIDES[cleanTitle];
  if (override) return override;
  const desc = normalizeSpacing(description);
  if (/^\d{4} film directed by|^\d{4} film by/i.test(desc)) {
    return `A recognizable movie title with memorable scenes, characters, and easy clue possibilities.`;
  }
  if (/^American television series\.?$/i.test(desc)) {
    return `A recognizable TV series with recurring characters, settings, and clue-friendly storylines.`;
  }
  if (/^American sitcom/i.test(desc)) {
    return `A sitcom with recurring jokes, familiar characters, and everyday situations that are easy to describe.`;
  }
  return description;
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
  const nextCandidates = candidates.filter((candidate) => candidate.category !== "movies");
  nextCandidates.push(
    ...cards.map((card) => ({
      status: card.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
      category: "movies",
      categoryLabel: "Movies & TV",
      id: `movies-${slugify(card.title)}`,
      title: normalizeSpacing(card.title),
      description: card.description,
      source: card.source
    }))
  );

  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
}

function updateReadme(movieCount: number) {
  if (!fs.existsSync(README_FILE)) return;
  const markdown = fs.readFileSync(README_FILE, "utf8");
  fs.writeFileSync(README_FILE, markdown.replace(/(\| movies-tv\.md \| 356 \| 440 \| )\d+(\s*\|)/, `$1${movieCount}$2`));
}

function normalizeTitle(value: string) {
  return normalizeSpacing(value).toLowerCase();
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
