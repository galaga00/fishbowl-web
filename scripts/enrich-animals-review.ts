import fs from "node:fs";
import path from "node:path";

type ReviewCard = {
  heading: string;
  keepLine: string;
  category: string;
  title: string;
  description: string;
  source: string;
};

type Summary = {
  title?: string;
  extract?: string;
  description?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

const REVIEW_FILE = path.join("card-review", "target-fill", "animals-nature.md");
const CANDIDATES_FILE = path.join("card-review", "target-fill", "candidates.json");
const README_FILE = path.join("card-review", "target-fill", "README.md");
const USER_AGENT = "fish-bowl-card-review-enricher/1.0";

const REMOVE_PREFIXES = [
  "arctic ",
  "artic ",
  "desert ",
  "rainforest ",
  "mountain ",
  "ocean ",
  "prairie ",
  "swamp ",
  "jungle ",
  "river "
];

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  Aurora: "A shimmering natural light display in the sky, most often seen near polar regions.",
  Bay: "A broad curve of water partly enclosed by land, often calmer than the open sea.",
  Beach: "A sandy or pebbly shore where land meets the ocean, lake, or river.",
  Blizzard: "A severe snowstorm with strong winds, blowing snow, and very low visibility.",
  Canyon: "A deep valley with steep sides, often carved over time by a river.",
  Cave: "A natural underground hollow or chamber, often found in rock or cliffs.",
  Cloud: "A visible mass of tiny water droplets or ice crystals floating in the sky.",
  "Coral reef": "An underwater ecosystem built by coral, often full of colorful fish and sea life.",
  Desert: "A dry landscape with little rainfall, sparse plants, and extreme temperatures.",
  Dew: "Tiny drops of water that form on cool surfaces, especially in the morning.",
  Fog: "A low cloud near the ground that makes the air look misty and hard to see through.",
  Forest: "A large area covered with trees, plants, and wildlife.",
  Geyser: "A hot spring that periodically erupts, shooting water and steam into the air.",
  Glacier: "A massive, slow-moving sheet or river of ice formed from compacted snow.",
  Hail: "Balls or pellets of ice that fall from storm clouds.",
  Iceberg: "A huge floating piece of freshwater ice that has broken off from a glacier.",
  Island: "A piece of land completely surrounded by water.",
  Lagoon: "A shallow body of water separated from a larger sea by sandbars, reefs, or islands.",
  Lake: "A large inland body of standing water surrounded by land.",
  Lightning: "A bright electrical flash in the sky during a storm.",
  Mountain: "A large natural rise of the Earth's surface, usually with steep sides and a summit.",
  Oasis: "A fertile spot in a desert where water allows plants to grow.",
  "Ocean wave": "A moving ridge of water on the ocean surface, often pushed by wind.",
  Pond: "A small body of still freshwater, usually shallower than a lake.",
  Prairie: "A wide open grassland with few trees.",
  Rainbow: "A colorful arc in the sky caused by sunlight passing through water droplets.",
  Rainstorm: "A storm with heavy rain, often accompanied by wind, thunder, or lightning.",
  River: "A natural flowing stream of water that usually empties into a lake, sea, or ocean.",
  "Sand dune": "A hill or ridge of sand shaped by wind.",
  Savanna: "A warm grassland ecosystem with scattered trees and seasonal rainfall.",
  Snowflake: "A tiny ice crystal with a delicate, often six-sided shape.",
  Swamp: "A wetland with standing water and water-loving trees or plants.",
  Thunderstorm: "A storm with thunder, lightning, rain, and sometimes strong wind.",
  "Tide pool": "A shallow pool of seawater left on rocky shores when the tide goes out.",
  Tornado: "A violently rotating column of air extending from a storm cloud to the ground.",
  Valley: "A low area between hills or mountains, often with a river running through it.",
  Volcano: "A mountain or vent where lava, ash, and gases can erupt from beneath the Earth.",
  Waterfall: "A place where a river or stream drops from a height over rock.",
  Whirlpool: "A spinning body of water caused by opposing currents or flowing around obstacles.",
  Windstorm: "A storm marked by strong winds that can bend trees and blow debris."
};

const OVERRIDE_DESCRIPTIONS: Record<string, string> = {
  Cougar: "A large wild cat also called a mountain lion or puma, known for stealth, speed, and long jumps.",
  Deer: "A hoofed grazing mammal with slender legs; many males grow antlers each year.",
  Donkey: "A domesticated long-eared member of the horse family, known for carrying loads and braying loudly.",
  Gazelle: "A graceful antelope known for speed, light leaps, and living in open grasslands or deserts.",
  Hedgehog: "A small nocturnal mammal covered in short spines that can curl into a ball for protection.",
  Jaguar: "A powerful spotted big cat from the Americas with a strong bite and a talent for swimming.",
  Lemur: "A wide-eyed primate from Madagascar, often recognized by a long tail and social behavior.",
  Llama: "A South American pack animal with a long neck, soft wool, and a famous habit of spitting.",
  Mole: "A small burrowing mammal with strong front paws built for digging underground tunnels.",
  Moose: "The largest member of the deer family, with long legs, a drooping nose, and broad antlers on males.",
  Mouse: "A tiny rodent with whiskers, a pointed snout, and a long tail.",
  Narwhal: "An Arctic whale famous for the long spiral tusk that grows from the upper jaw of males.",
  Panda: "A black-and-white bear from China known for eating bamboo and having round dark eye patches.",
  Panther: "A large black-coated leopard or jaguar, often imagined as a sleek and stealthy big cat.",
  Raccoon: "A masked, ring-tailed mammal known for clever paws, nighttime scavenging, and washing motions.",
  Rat: "A sharp-nosed rodent with a long tail, known for intelligence and living close to humans.",
  Reindeer: "A cold-weather deer also called caribou, with large hooves and antlers grown by both sexes.",
  Rhinoceros: "A massive thick-skinned herbivore with one or two horns on its snout.",
  Seal: "A streamlined marine mammal with flippers, whiskers, and a habit of resting on rocks or ice.",
  Sheep: "A woolly domesticated grazing animal often raised for fleece, milk, and meat.",
  Skunk: "A black-and-white mammal known for spraying a strong-smelling liquid when threatened.",
  Squirrel: "A nimble rodent with a bushy tail, often seen climbing trees and hiding nuts.",
  Pelican: "A large water bird with a long bill and expandable throat pouch for scooping fish.",
  Puffin: "A small seabird with a colorful beak, black-and-white body, and awkward waddling walk.",
  Raven: "A large black bird known for intelligence, a deep croaking call, and glossy feathers.",
  Roadrunner: "A fast-running desert bird with a long tail and crest, often seen sprinting along the ground.",
  Rooster: "An adult male chicken known for crowing, bright combs, and strutting around a flock.",
  Seagull: "A coastal bird with long wings, loud calls, and a talent for stealing snacks near beaches.",
  Toucan: "A tropical bird with a huge colorful bill and a fruit-heavy diet.",
  Vulture: "A scavenging bird with broad wings that feeds on carrion and often circles overhead.",
  Woodpecker: "A tree-climbing bird that drums on bark with its beak to find insects or make nest holes.",
  "Boa constrictor": "A large nonvenomous snake that squeezes prey with powerful coils.",
  Bullfrog: "A large frog with a deep booming call, often found near ponds and marshes.",
  Gecko: "A small lizard often known for sticky toe pads that help it climb walls and ceilings.",
  "Gila monster": "A heavy-bodied venomous lizard from the southwestern United States and northern Mexico.",
  Iguana: "A large herbivorous lizard with a spiny crest, long tail, and strong claws.",
  Newt: "A small amphibian related to salamanders, often living part of its life in water.",
  "Poison dart frog": "A tiny brightly colored frog whose skin toxins inspired the name used for poison darts.",
  Python: "A large nonvenomous snake that kills prey by constriction and often has patterned scales.",
  Rattlesnake: "A venomous snake with a rattling tail used as a warning signal.",
  Salamander: "A moist-skinned amphibian with a long body and tail, often found under logs or near water.",
  "Sea snake": "A venomous snake adapted for ocean life, with a flattened tail for swimming.",
  Skink: "A smooth-scaled lizard with short legs and a shiny, streamlined body.",
  "Snapping turtle": "A freshwater turtle with a powerful bite, long tail, and rugged shell.",
  Toad: "A squat amphibian with dry bumpy skin, often seen hopping on land after rain.",
  "Tree frog": "A small climbing frog with sticky toe pads and a loud call from trees or plants.",
  Turtle: "A shelled reptile that can pull its head and limbs partly inside for protection.",
  Aphid: "A tiny sap-sucking insect often found clustered on plant stems and leaves.",
  Beetle: "An insect with hardened front wings that form a protective shell over its body.",
  Caterpillar: "The soft-bodied larval stage of a butterfly or moth, famous for munching leaves.",
  Centipede: "A many-legged predatory arthropod with a flattened body and fast movement.",
  Cicada: "A loud tree-dwelling insect known for buzzing summer calls and shed skins.",
  Cricket: "A jumping insect known for chirping sounds made by rubbing its wings together.",
  Firefly: "A beetle that produces flashes of light from its abdomen, especially on warm evenings.",
  Flea: "A tiny jumping insect that feeds on the blood of mammals and birds.",
  Grasshopper: "A strong-legged insect that jumps through grass and makes rasping sounds.",
  Honeybee: "A social bee that gathers nectar, pollinates flowers, and makes honey in hives.",
  Ladybug: "A small rounded beetle, often red with black spots, that eats plant pests like aphids.",
  Mantis: "A predatory insect with folded grasping forelegs and a triangular head.",
  Millipede: "A slow-moving arthropod with many tiny legs and a rounded body.",
  Moth: "A winged insect related to butterflies, often active at night and drawn to lights.",
  "Praying mantis": "A predatory insect with folded front legs that look like hands in prayer.",
  "Scarab beetle": "A rounded beetle associated with dung rolling and ancient Egyptian symbolism.",
  Snail: "A slow-moving mollusk with a spiral shell and a soft body that glides on a muscular foot.",
  Spider: "An eight-legged arachnid that often spins silk webs to catch prey.",
  "Stick insect": "A long thin insect whose body mimics twigs or branches for camouflage.",
  Termite: "A social insect that lives in colonies and feeds on wood or other plant material.",
  Wasp: "A narrow-waisted flying insect, often with a stinger and a more aggressive reputation than bees.",
  Worm: "A soft, limbless animal that burrows through soil and helps break down organic matter.",
  Ankylosaurus: "An armored dinosaur with bony plates and a heavy club at the end of its tail.",
  Brachiosaurus: "A huge long-necked dinosaur with front legs taller than its back legs.",
  Brontosaurus: "A giant long-necked sauropod dinosaur with a massive body and whip-like tail.",
  Diplodocus: "A very long sauropod dinosaur with a slender neck, long tail, and four pillar-like legs.",
  Iguanodon: "A plant-eating dinosaur known for its thumb spikes and bulky body.",
  Megalodon: "An extinct giant shark with enormous teeth, far larger than modern great white sharks.",
  Mosasaurus: "A huge extinct marine reptile with powerful jaws that lived in the Late Cretaceous seas.",
  Pachycephalosaurus: "A dinosaur with an unusually thick domed skull, often imagined head-butting rivals.",
  Parasaurolophus: "A duck-billed dinosaur with a long curved head crest that may have helped make sounds.",
  Spinosaurus: "A large predatory dinosaur with a tall sail on its back and crocodile-like jaws.",
  "Tyrannosaurus rex": "A massive meat-eating dinosaur with huge teeth, powerful jaws, and tiny arms.",
  Acorn: "The nut of an oak tree, usually capped and often gathered by squirrels.",
  "Aloe vera": "A succulent plant with thick gel-filled leaves often used for soothing skin.",
  Carnation: "A ruffled flower with clove-like scent, commonly used in bouquets and corsages.",
  Clover: "A low-growing plant with three-part leaves; lucky four-leaf versions are famous.",
  Daisy: "A simple flower with white petals around a yellow center.",
  Dandelion: "A yellow lawn flower that turns into a fluffy seed head kids often blow into the wind.",
  Fern: "A leafy green plant that reproduces with spores instead of flowers or seeds.",
  Ivy: "A climbing or trailing vine with glossy leaves that can cover walls and trees.",
  "Lily pad": "A round floating leaf of a water lily, often pictured with frogs sitting on it.",
  "Maple leaf": "The distinctive pointed leaf of a maple tree, famous as a symbol of Canada.",
  Marigold: "A bright orange or yellow flower with a strong scent, often planted in gardens.",
  Mistletoe: "A parasitic plant traditionally hung during winter holidays for kissing underneath.",
  Moss: "A soft green plant that grows in dense mats on damp rocks, soil, and tree bark.",
  Mushroom: "The visible fruiting body of a fungus, often with a cap and stalk.",
  "Oak tree": "A sturdy tree known for acorns, broad branches, and strong hardwood.",
  "Palm tree": "A tropical tree with a tall trunk and large fan-shaped or feather-like leaves.",
  "Pine tree": "An evergreen conifer with needles, cones, and a fresh resin scent.",
  Pinecone: "The woody cone of a pine tree, made of layered scales that hold seeds.",
  "Poison ivy": "A climbing plant with three leaflets that can cause an itchy rash when touched.",
  "Pumpkin vine": "A sprawling plant with broad leaves and curling tendrils that grows pumpkins.",
  "Redwood tree": "A towering evergreen tree famous for its enormous height and reddish bark.",
  Seaweed: "A marine algae that grows in oceans and can wave like ribbons underwater.",
  Vine: "A climbing or trailing plant that uses tendrils, stems, or roots to grab support.",
  "Water lily": "An aquatic plant with floating round leaves and showy flowers on pond surfaces.",
  "Willow tree": "A tree often recognized by long drooping branches and narrow leaves.",
  Avalanche: "A sudden rush of snow, ice, and rocks down a mountain slope.",
  "Hot spring": "A naturally heated pool of groundwater warmed by geothermal activity.",
  "Meteor shower": "A sky event where many meteors streak through the atmosphere from the same direction.",
  "Moon crater": "A bowl-shaped hollow on the Moon made by impacts from rocks in space.",
  Mudslide: "A fast-moving flow of wet earth, mud, and debris down a slope.",
  "Solar eclipse": "An event where the Moon passes between Earth and the Sun, blocking sunlight."
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const original = fs.readFileSync(REVIEW_FILE, "utf8");
  const { header, cards } = parseReviewMarkdown(original);
  const filteredCards = cards.filter((card) => !isDeleteMarker(card.keepLine) && !shouldRemove(card.title));

  for (const card of filteredCards) {
    const override = OVERRIDE_DESCRIPTIONS[card.title];
    if (override) {
      card.description = override;
      card.source = "curated-description";
      continue;
    }
    const summary = await fetchSummary(card.title);
    const description = summary ? descriptionFromSummary(summary) : FALLBACK_DESCRIPTIONS[card.title];
    if (description) {
      card.description = description;
      card.source = summary?.content_urls?.desktop?.page ?? card.source;
    }
  }

  fs.writeFileSync(REVIEW_FILE, renderReviewMarkdown(header, filteredCards));
  updateCandidatesJson(filteredCards);
  updateReadme(filteredCards.length);

  console.log(`Animals & Nature cards: ${cards.length} -> ${filteredCards.length}`);
  console.log(`Removed delete/prefix cards: ${cards.length - filteredCards.length}`);
}

function parseReviewMarkdown(markdown: string) {
  const firstCard = markdown.indexOf("\n## ");
  const header = markdown.slice(0, firstCard).trimEnd();
  const body = markdown.slice(firstCard).trim();
  const rawCards = body.split(/\n(?=## )/g).filter(Boolean);
  const cards = rawCards.map(parseCardBlock);
  return { header, cards };
}

function parseCardBlock(block: string): ReviewCard {
  const lines = block.split("\n");
  return {
    heading: lines[0].replace(/^##\s+/, "").trim(),
    keepLine: lines.find((line) => /^- \[[ x]\] (Keep|Delete)$/i.test(line)) ?? "- [x] Keep",
    category: readField(lines, "Category"),
    title: readField(lines, "Title"),
    description: readField(lines, "Description"),
    source: readField(lines, "Source")
  };
}

function readField(lines: string[], field: string) {
  return lines.find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2).trim() ?? "";
}

function shouldRemove(title: string) {
  const normalized = title.toLowerCase();
  if (normalized === "prairie dog") return false;
  return REMOVE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isDeleteMarker(keepLine: string) {
  return /\bdelete\b/i.test(keepLine);
}

async function fetchSummary(title: string): Promise<Summary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return fetchSummaryFromSearch(title);
  const summary = await response.json() as Summary & { type?: string };
  if (summary.type === "disambiguation" || summary.type === "no-extract") return fetchSummaryFromSearch(title);
  return summary;
}

async function fetchSummaryFromSearch(title: string): Promise<Summary | null> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${title} animal nature`,
    srlimit: "5",
    format: "json",
    origin: "*"
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "user-agent": USER_AGENT }
  });
  if (!response.ok) return null;
  const data = await response.json() as { query?: { search?: Array<{ title: string }> } };
  const results = data.query?.search ?? [];
  for (const result of results) {
    if (/list of|category:|index of/i.test(result.title)) continue;
    const summary = await fetchExactSummary(result.title);
    if (summary) return summary;
  }
  return null;
}

async function fetchExactSummary(title: string): Promise<Summary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const summary = await response.json() as Summary & { type?: string };
  if (summary.type === "disambiguation" || summary.type === "no-extract") return null;
  return summary;
}

function descriptionFromSummary(summary: Summary) {
  const extract = cleanSentence(summary.extract ?? "");
  if (extract && !/may refer to/i.test(extract)) return extract;
  return cleanSentence(summary.description ?? "");
}

function cleanSentence(value: string) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+,/g, ",")
    .trim();
  const firstSentence = cleaned.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? cleaned;
  return firstSentence.length > 190 ? `${firstSentence.slice(0, 187).replace(/\s+\S*$/, "")}...` : firstSentence;
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
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8")) as Array<{
    category: string;
    title: string;
    description: string;
    source: string;
    status: string;
  }>;
  const byTitle = new Map(cards.map((card) => [card.title, card]));
  const nextCandidates = candidates
    .filter((candidate) => candidate.category !== "animals_nature" || byTitle.has(candidate.title))
    .map((candidate) => {
      if (candidate.category !== "animals_nature") return candidate;
      const reviewedCard = byTitle.get(candidate.title);
      if (!reviewedCard) return candidate;
      return {
        ...candidate,
        status: reviewedCard.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
        description: reviewedCard.description,
        source: reviewedCard.source
      };
    });
  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
}

function updateReadme(animalsCount: number) {
  if (!fs.existsSync(README_FILE)) return;
  const markdown = fs.readFileSync(README_FILE, "utf8");
  fs.writeFileSync(README_FILE, markdown.replace(/(\| animals-nature\.md \| 45 \| 440 \| )\d+(\s*\|)/, `$1${animalsCount}$2`));
}
