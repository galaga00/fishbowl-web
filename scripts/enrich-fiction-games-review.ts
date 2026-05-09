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

const REVIEW_FILE = path.join("card-review", "target-fill", "fiction-games.md");
const CANDIDATES_FILE = path.join("card-review", "target-fill", "candidates.json");
const README_FILE = path.join("card-review", "target-fill", "README.md");

const ORIGINAL_CARDS: Record<string, { description: string; source: string }> = {
  "Call of Duty": {
    description: "2003 first-person shooter video game that launched the military action series.",
    source: "http://www.wikidata.org/entity/Q211096"
  },
  "Need for Speed": {
    description: "1994 racing video game that launched the long-running street and sports car series.",
    source: "curated-description"
  },
  "The Sims": {
    description: "2000 life simulation video game where players create people, build homes, and manage everyday lives.",
    source: "curated-description"
  }
};

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  "Donald Duck": "A short-tempered Disney duck with a sailor shirt, a squawky voice, and endless comic frustration.",
  "Homer Simpson": "The donut-loving Simpsons dad from Springfield, known for laziness, big mistakes, and saying d'oh.",
  "Minnie Mouse": "Mickey Mouse's classic Disney partner, known for her bow, polka dots, and cheerful cartoon style.",
  "Super Mario Bros.": "A side-scrolling platform game where Mario runs, jumps, grabs power-ups, and rescues Princess Peach.",
  "Half-Life": "A sci-fi shooter about physicist Gordon Freeman surviving an alien disaster at Black Mesa.",
  "League of Legends": "A team arena game where champions battle in lanes, destroy towers, and push toward the enemy base.",
  "Bart Simpson": "The prank-loving Simpsons kid with a skateboard, spiky hair, and a talent for getting in trouble.",
  Popeye: "A spinach-powered sailor with huge forearms, a squinty eye, and a habit of punching through problems.",
  Skyrim: "A fantasy role-playing game about dragons, shouts, open-world quests, and the Dragonborn.",
  "Luke Skywalker": "The Star Wars farm boy turned Jedi hero, tied to lightsabers, the Force, and Darth Vader.",
  Wolverine: "An X-Men mutant with metal claws, rapid healing, sideburns, and a famously gruff attitude.",
  "Naruto Uzumaki": "An orange-clad ninja who dreams of becoming Hokage and fights with shadow clones and big energy.",
  "Obi-Wan Kenobi": "A wise Star Wars Jedi mentor known for lightsaber duels, calm advice, and watching over Luke.",
  Goofy: "A tall, clumsy Disney character with a floppy walk, big laugh, and lovable awkwardness.",
  Dota: "A multiplayer battle arena game where teams control heroes, fight creeps, and defend ancient bases.",
  "Genshin Impact": "An anime-styled open-world adventure about elemental powers, party characters, and exploring Teyvat.",
  "Princess Leia": "A Star Wars princess and rebel leader with iconic hair buns, bravery, and sharp comebacks.",
  "Assassin's Creed": "A stealth action game about hooded assassins, parkour, hidden blades, and historical conspiracies.",
  Pong: "An early arcade game where two paddles bounce a square ball back and forth like table tennis.",
  Portal: "A puzzle game where players use a portal gun, test chambers, and dark humor from GLaDOS.",
  "Marge Simpson": "The tall-blue-haired Simpsons mom who tries to keep the family together in Springfield.",
  "Lisa Simpson": "The saxophone-playing Simpsons daughter, known for intelligence, activism, and moral seriousness.",
  Daredevil: "A blind Marvel vigilante with heightened senses, acrobatics, and a red costume.",
  "Age of Empires": "A real-time strategy game about gathering resources, building armies, and advancing civilizations.",
  "Grand Theft Auto": "An open-world crime game series known for cars, city chaos, missions, and satirical radio.",
  "Daisy Duck": "A fashionable Disney duck with a bow, attitude, and a close connection to Donald Duck.",
  BioShock: "A first-person adventure set in the underwater city of Rapture, with plasmids and eerie art deco halls.",
  Undertale: "An indie role-playing game where players can befriend monsters instead of fighting them.",
  "Han Solo": "A cocky Star Wars smuggler with the Millennium Falcon, Chewbacca, and a fast blaster draw.",
  Aragorn: "The ranger and hidden king from The Lord of the Rings, known for courage, swordplay, and leadership.",
  Mafia: "A crime action game about mob families, old cars, and missions in a gritty city.",
  "Sasuke Uchiha": "A brooding Naruto ninja with Sharingan eyes, lightning attacks, and a rivalry with Naruto.",
  "Space Invaders": "A classic arcade shooter where rows of aliens march downward while the player fires from below.",
  Spore: "A simulation game about guiding a species from tiny creature to civilization and space travel.",
  "Max Payne": "A noir action game known for slow-motion gunfights, tragedy, and detective-style narration.",
  "Padmé Amidala": "A Star Wars queen and senator known for elaborate outfits, diplomacy, and ties to Anakin Skywalker.",
  "Red Dead Redemption": "A western action game about outlaws, horses, frontier towns, and life at the end of the Wild West.",
  "Metal Gear Solid": "A stealth action game about sneaking past guards, hiding in boxes, and cinematic spy missions.",
  "Till Eulenspiegel": "A mischievous trickster from German folklore known for pranks, jokes, and exposing foolishness.",
  "Qui-Gon Jinn": "A calm Star Wars Jedi master who discovers Anakin and trusts the Living Force.",
  Chewbacca: "Han Solo's towering Wookiee co-pilot, known for roaring, loyalty, and fixing the Millennium Falcon.",
  Zorro: "A masked sword-fighting hero in black, known for carving the letter Z and defending the oppressed.",
  "Professor X": "The telepathic founder of the X-Men, often shown guiding mutants from a wheelchair.",
  "Far Cry": "An open-world shooter series known for wild outposts, dangerous landscapes, and chaotic villains.",
  Overwatch: "A team shooter where colorful heroes use unique powers to capture objectives and protect teammates.",
  "Agar.io": "A simple browser game where circles eat smaller circles and grow while dodging larger players.",
  "R2-D2": "A beeping Star Wars astromech droid who stores plans, hacks computers, and saves heroes repeatedly.",
  "Monkey D. Luffy": "The stretchy pirate captain from One Piece who wears a straw hat and hunts for treasure.",
  "Harley Quinn": "A chaotic DC character with pigtails, a bat or mallet, and a wild sense of humor.",
  "Sakura Haruno": "A Naruto ninja and medic known for strength, healing skills, and ties to Team 7.",
  "Mace Windu": "A stern Star Wars Jedi master with a purple lightsaber and a commanding presence.",
  Harlequin: "A masked comic servant from Italian theater, known for tricks, slapstick, and a diamond-pattern costume.",
  "Green Arrow": "A DC archer superhero with trick arrows, a green hood, and street-level crimefighting.",
  "Wii Sports": "A motion-control sports game with bowling, tennis, baseball, boxing, and golf using Miis.",
  "Stardew Valley": "A cozy farming game about crops, fishing, mining, friendships, and restoring a small town.",
  "Apex Legends": "A battle royale shooter where squads choose unique legends and fight to survive.",
  "Robert Langdon": "A symbologist from Dan Brown thrillers who solves codes, art clues, and historical mysteries.",
  "Professor Moriarty": "Sherlock Holmes's criminal mastermind rival, known as the Napoleon of crime.",
  "Vito Corleone": "The Godfather's powerful mafia patriarch, known for quiet authority and family loyalty.",
  "Big Brother": "The all-seeing ruler symbol from Nineteen Eighty-Four, tied to surveillance and propaganda.",
  "Jean Grey": "A Marvel mutant and X-Men member with telepathy, telekinesis, and the Phoenix identity.",
  Diablo: "A dark fantasy action role-playing game about dungeon crawling, loot, demons, and clicking through monsters.",
  "Age of Mythology": "A strategy game about ancient civilizations, myth units, gods, and legendary monsters.",
  Civilization: "A turn-based strategy game about founding cities, researching technology, and guiding an empire through history.",
  "Assassin's Creed: Brotherhood": "An Assassin's Creed game set in Renaissance Rome with recruits, parkour, and hidden-blade missions.",
  "Black Widow": "A Marvel spy and Avenger known for espionage, martial arts, gadgets, and a black suit.",
  Punisher: "A Marvel vigilante with a skull symbol who wages a ruthless war on criminals.",
  "S.T.A.L.K.E.R.: Shadow of Chernobyl": "A tense shooter set in the Chernobyl Exclusion Zone with anomalies, scavengers, and survival horror.",
  "Mass Effect": "A sci-fi role-playing game about Commander Shepard, alien squadmates, and galaxy-saving choices.",
  "The Witcher": "A fantasy role-playing game about Geralt, monster contracts, potions, swords, and moral choices.",
  "Resident Evil": "A survival horror game series known for zombies, creepy mansions, bio-weapons, and limited supplies.",
  Bully: "A schoolyard action game about cliques, classes, pranks, and trouble at Bullworth Academy.",
  "Horizon Zero Dawn": "An action role-playing game about Aloy hunting robotic creatures in a lush post-apocalyptic world.",
  "Darth Maul": "A Star Wars Sith warrior with red-and-black tattoos and a double-bladed lightsaber.",
  "Kakashi Hatake": "A masked Naruto ninja teacher known for one visible eye, copied jutsu, and calm confidence.",
  "Lex Luthor": "Superman's brilliant bald enemy, known for wealth, schemes, and hatred of alien power.",
  Crysis: "A sci-fi shooter known for nanosuit powers, stealth, strength, and high-end graphics.",
  "Assassin's Creed: Revelations": "An Assassin's Creed game following Ezio and Altaïr through Constantinople and hidden history.",
  "Five Nights at Freddy's": "A horror game about surviving nights while creepy animatronics roam a pizza restaurant.",
  Cuphead: "A run-and-gun game with 1930s cartoon style, boss fights, and a deal with the devil.",
  "Catwoman": "A DC burglar and antihero with a cat-themed costume, whip, and complicated bond with Batman.",
  "Scott Pilgrim": "A comic and game character who battles evil exes with music, jokes, and video-game logic.",
  "Lara Croft": "The Tomb Raider adventurer known for exploring ruins, solving puzzles, and escaping traps.",
  "John Rambo": "An action hero and veteran known for survival skills, headbands, and explosive one-man missions.",
  "SpongeBob SquarePants": "An optimistic sponge who works at the Krusty Krab and lives in a pineapple under the sea.",
  "Pac-Man": "An arcade maze game where a yellow character eats dots while dodging colorful ghosts.",
  "Life Is Strange": "A narrative adventure game about teen drama, photography, time powers, and difficult choices.",
  "Luke Cage": "A Marvel hero with unbreakable skin, super strength, and a Harlem street-level style.",
  "Pikachu": "The yellow electric Pokémon mascot known for red cheeks, lightning attacks, and saying its name.",
  "Shadow the Hedgehog": "A dark Sonic character with red stripes, hover shoes, and a serious rival attitude.",
  "Miles \"Tails\" Prower": "Sonic's two-tailed fox sidekick, known for flying by spinning his tails like a propeller.",
  "Spock": "The logical half-Vulcan Star Trek officer known for pointed ears and the Vulcan salute.",
  "James T. Kirk": "The bold Star Trek captain of the Enterprise, known for command decisions and space adventure.",
  "Rachel Green": "A Friends character who starts as a runaway bride and builds a fashion career.",
  "Ross Geller": "A Friends paleontologist known for dinosaurs, divorces, and yelling about being on a break.",
  "Monica Geller": "A competitive Friends character known for cooking, cleaning, and hosting the apartment hangout.",
  "Eric Cartman": "A South Park kid known for selfish schemes, a blue hat, and outrageous insults.",
  "Kenny McCormick": "A South Park kid in an orange parka, famous for muffled speech and repeated deaths.",
  "Jar Jar Binks": "A clumsy Gungan from Star Wars known for long ears, slapstick, and a divisive reputation.",
  "Captain Marvel": "A Marvel superhero associated with cosmic powers, flight, energy blasts, and a star emblem.",
  "Star Wars: Knights of the Old Republic": "A role-playing game set long before the films, with Jedi choices and a famous twist.",
  "Dead Space": "A survival horror game about fighting necromorphs aboard dark, broken spaceships.",
  "Lego Star Wars": "A playful Lego game version of Star Wars with brick-building, slapstick, and lightsaber action.",
  "Animal Crossing": "A cozy life-sim game about decorating, fishing, catching bugs, and befriending animal neighbors.",
  "Cities: Skylines": "A city-building game about zoning roads, managing traffic, and growing a modern metropolis.",
  "Joey Tribbiani": "A Friends actor known for charm, sandwiches, and the catchphrase how you doin.",
  "Phoebe Buffay": "A quirky Friends musician and masseuse known for Smelly Cat and odd stories.",
  "Chandler Bing": "A sarcastic Friends character known for jokes, awkwardness, and office mystery.",
  "Stan Marsh": "A South Park kid in a blue-and-red hat, often the show's more ordinary viewpoint.",
  "Kyle Broflovski": "A South Park kid in a green hat, often serious, moral, and quick to argue.",
  Yoda: "A tiny green Jedi master known for wisdom, backwards speech, and training Luke Skywalker.",
  Elektra: "A Marvel assassin known for red outfits, twin sai weapons, and ties to Daredevil.",
  RuneScape: "An online fantasy role-playing game about quests, skills, trading, and a huge medieval world.",
  Spelunky: "A cave-exploring platform game about traps, treasure, bombs, ropes, and sudden disasters.",
  "Lego Indiana Jones": "A Lego adventure game with whips, treasure, slapstick puzzles, and scenes from Indiana Jones.",
  "The Sims": "A life simulation game where players create people, build homes, and manage everyday chaos.",
  "Rocket League": "A sports game where rocket-powered cars play soccer in giant arenas.",
  "PUBG: Battlegrounds": "A battle royale game where players parachute in, scavenge gear, and fight to be the last survivor.",
  "Soulcalibur VI": "A weapon-based fighting game with swords, dramatic arenas, and fantasy characters.",
  "Hollow Knight": "A moody metroidvania about exploring an underground insect kingdom with tight platforming and combat.",
  "Stewie Griffin": "A Family Guy baby with a football-shaped head, posh voice, and schemes far beyond his age.",
  "Peter Griffin": "The loud, clueless Family Guy dad known for cutaway jokes, bad decisions, and a Rhode Island accent.",
  "Maggie Simpson": "The pacifier-sucking Simpsons baby, mostly silent but often surprisingly capable.",
  "Gaara": "A Naruto ninja who controls sand and carries a giant gourd on his back.",
  "Ichigo Kurosaki": "The Bleach hero with orange hair, a huge sword, and Soul Reaper powers.",
  Wolfenstein: "A first-person shooter series about fighting Nazis, secret bases, and over-the-top alternate history.",
  Pikmin: "A strategy game about commanding tiny plant-like helpers to solve puzzles and carry objects.",
  "Star Wars Galaxies": "An online Star Wars role-playing game about living, crafting, and adventuring across the galaxy."
  ,
  "Dr. Eggman": "Sonic's mustached mad scientist villain, known for robots, flying machines, and elaborate schemes."
  ,
  Tetris: "A falling-block puzzle game where players rotate shapes to clear horizontal lines.",
  "Cyberpunk 2077": "A neon sci-fi role-playing game set in Night City, full of implants, gangs, and mercenary jobs.",
  Doom: "A fast first-person shooter about blasting demons with big weapons on Mars and in hellish arenas.",
  "The Legend of Zelda: Breath of the Wild": "An open-world Zelda adventure about exploring Hyrule, climbing mountains, cooking, and fighting Calamity Ganon.",
  "Super Mario 64": "A 3D Mario platformer about jumping through paintings, collecting stars, and exploring Peach's castle.",
  Valorant: "A tactical team shooter where agents use precise gunplay and special abilities to attack or defend sites.",
  "Left 4 Dead": "A cooperative zombie shooter where survivors fight through hordes using teamwork and safe rooms.",
  "Halo: Combat Evolved": "A sci-fi shooter about Master Chief, alien enemies, ringworld battles, and iconic multiplayer.",
  "Super Mario World": "A colorful Mario platformer with Yoshi, secret exits, capes, and Dinosaur Land.",
  "Brawl Stars": "A mobile arena game where small teams of brawlers fight in quick cartoon battles.",
  "Candy Crush Saga": "A match-three puzzle game about swapping candy pieces to clear colorful objectives.",
  "Tomb Raider": "An adventure game about Lara Croft exploring tombs, solving puzzles, and dodging traps.",
  "The Legend of Zelda: Ocarina of Time": "A Zelda adventure about time travel, dungeons, ocarina songs, and saving Hyrule.",
  "Mario Kart Wii": "A racing game with Mario characters, motion controls, power-up items, and chaotic kart tracks.",
  "Angry Birds": "A puzzle game where players launch birds from a slingshot to knock down pig forts.",
  "Black Myth: Wukong": "An action role-playing game inspired by Journey to the West, starring the Monkey King in mythic battles.",
  "Hogwarts Legacy": "An open-world wizarding game about attending Hogwarts, casting spells, and exploring magical locations.",
  "Dark Souls": "A challenging dark fantasy action game known for bonfires, bosses, and punishing combat.",
  "Spacewar!": "An early space combat game where two ships duel around a star's gravity.",
  "Gordon Freeman": "The silent Half-Life scientist hero known for a crowbar, glasses, and surviving alien disasters.",
  Wario: "Mario's greedy yellow-and-purple rival, known for garlic, treasure hunting, and chaotic mini-games.",
  "Super Mario Galaxy": "A Mario platformer about leaping between tiny planets, gravity tricks, and collecting Power Stars.",
  Minesweeper: "A logic puzzle game about revealing safe squares while avoiding hidden mines.",
  Limbo: "A stark black-and-white puzzle platformer about a boy crossing a dangerous shadowy world.",
  "Final Fantasy": "A fantasy role-playing series known for parties, summons, crystals, airships, and dramatic battles.",
  Outlast: "A survival horror game where players hide, run, and film terrifying events in an asylum.",
  "Battlefield 1": "A World War I shooter with large battles, vehicles, trenches, and cinematic multiplayer moments.",
  "Super Mario Odyssey": "A Mario platformer where Mario uses Cappy to possess enemies and collect moons across kingdoms.",
  "Ghost of Tsushima": "A samurai action game about defending Tsushima with swordplay, stealth, and windswept landscapes.",
  "Warcraft: Orcs & Humans": "A real-time strategy game about humans and orcs building bases and battling for Azeroth.",
  "The Legend of Zelda: A Link to the Past": "A top-down Zelda adventure about the Light World, Dark World, dungeons, and the Master Sword.",
  "The Legend of Zelda: Majora's Mask": "A Zelda adventure with a three-day time loop, masks, and a falling moon.",
  "Silent Hill": "A psychological horror game set in a foggy town full of monsters, sirens, and dread.",
  "Watch Dogs": "An open-world hacking game about using phones, cameras, and city systems to outsmart enemies.",
  "Mount & Blade": "A medieval sandbox game about mounted combat, recruiting armies, and building power across kingdoms.",
  "Flappy Bird": "A simple mobile game where a tiny bird flaps through pipes with brutally difficult timing.",
  "Prince of Persia: The Sands of Time": "An action-adventure game about wall-running, traps, and rewinding time with a magical dagger.",
  "The Legend of Zelda: Twilight Princess": "A Zelda adventure with wolf Link, twilight realms, dungeons, and horseback battles.",
  "The Walking Dead: Season One": "A story-driven zombie game about choices, survival, and protecting Clementine.",
  "Super Mario Bros.: The Lost Levels": "A tough Mario platformer with tricky jumps, poison mushrooms, and old-school difficulty.",
  "Pokémon Yellow": "A Pokémon game inspired by the anime, with Pikachu following the player around.",
  "Mario Kart 64": "A Nintendo 64 kart racer with four-player chaos, item boxes, and classic tracks.",
  "Mario Kart DS": "A handheld Mario Kart game with drifting, item attacks, and portable multiplayer races.",
  "No Man's Sky": "A space exploration game about discovering planets, gathering resources, and flying between star systems.",
  "Assassin's Creed Unity": "An Assassin's Creed game set during the French Revolution with parkour across Paris.",
  "Geometry Dash": "A rhythm platformer where a square jumps through spikes and obstacles in time with music.",
  "Dead by Daylight": "An asymmetric horror game where survivors repair generators while one player hunts them as the killer.",
  "FIFA 18": "A soccer simulation game with real clubs, players, stadiums, and competitive matches.",
  "Super Smash Bros. Ultimate": "A crossover fighting game where Nintendo and guest characters knock each other off stages.",
  "Carl Johnson": "The Grand Theft Auto: San Andreas protagonist, known as CJ, returning to Grove Street and Los Santos.",
  "Niko Bellic": "The Grand Theft Auto IV protagonist, an immigrant in Liberty City chasing work, loyalty, and revenge.",
  "Wolfenstein 3D": "An early first-person shooter about escaping a Nazi fortress and fighting through maze-like levels.",
  "Empire Earth": "A real-time strategy game about leading civilizations across many eras of history.",
  "EVE Online": "A massive online space game about player-run corporations, starships, trade, and huge battles."
};

const Q_RENAMES: Record<string, { title: string; description: string }> = {
  Q165929: {
    title: "StarCraft",
    description: "1998 real-time strategy game about three factions battling across a science fiction galaxy."
  },
  Q28937399: {
    title: "PUBG: Battlegrounds",
    description: "Battle royale game where players scavenge gear and fight to be the last one standing."
  },
  Q163628: {
    title: "Counter-Strike",
    description: "Team-based first-person shooter where terrorists and counter-terrorists compete in objective rounds."
  },
  Q332697: {
    title: "Terraria",
    description: "2D sandbox adventure game about digging, crafting, building, exploring, and fighting monsters."
  },
  Q379128: {
    title: "Plants vs. Zombies",
    description: "Tower defense game where garden plants protect a house from waves of zombies."
  },
  Q60102: {
    title: "Fallout",
    description: "Post-apocalyptic role-playing game set in a retro-futuristic wasteland."
  },
  Q18345138: {
    title: "God of War",
    description: "Action-adventure game series about Kratos, mythological monsters, and dramatic battles with gods."
  },
  Q217423: {
    title: "Quake",
    description: "Fast-paced 1996 first-person shooter known for dark levels, monsters, and arena combat."
  },
  Q6497116: {
    title: "Myst",
    description: "Puzzle adventure game about exploring mysterious islands through linked books."
  },
  Q590836: {
    title: "Temple Run",
    description: "Endless running mobile game where a character dodges obstacles while fleeing through ancient ruins."
  },
  Q761815: {
    title: "Chrono Trigger",
    description: "Classic role-playing game about time travel, memorable companions, and changing history."
  }
};

const Q_DELETE_IDS = new Set([
  "Q17452",
  "Q211096",
  "Q27438121",
  "Q842146",
  "Q2377",
  "Q12395",
  "Q15712701",
  "Q214142",
  "Q718448",
  "Q733992",
  "Q247210",
  "Q18149274",
  "Q21246348",
  "Q17146",
  "Q203310",
  "Q111165107",
  "Q206653",
  "Q64441774",
  "Q162751",
  "Q473673"
]);

const DELETE_TITLES = new Set([
  "Assassin's Creed II",
  "Assassin's Creed III",
  "Assassin's Creed IV: Black Flag",
  "Battlefield 3",
  "Battlefield 4",
  "Civilization V",
  "Civilization VI",
  "Crusader Kings II",
  "Diablo II",
  "Diablo III",
  "Euro Truck Simulator 2",
  "Europa Universalis IV",
  "Fallout 2",
  "Fallout 3",
  "Fallout 4",
  "Halo 2",
  "Halo 3",
  "Left 4 Dead 2",
  "Mafia II",
  "Mario Kart 8",
  "Mass Effect 2",
  "Max Payne 3",
  "Silent Hill 2",
  "Super Mario Bros. 2",
  "Super Mario Bros. 3",
  "Team Fortress 2",
  "Tekken 3",
  "The Elder Scrolls IV: Oblivion",
  "The Last of Us Part II",
  "Zelda II: The Adventure of Link"
]);

const SERIES_RULES: Array<{ startsWith: string; keep: string }> = [
  { startsWith: "Grand Theft Auto", keep: "Grand Theft Auto" },
  { startsWith: "The Sims", keep: "The Sims" },
  { startsWith: "Call of Duty", keep: "Call of Duty" },
  { startsWith: "Far Cry", keep: "Far Cry" },
  { startsWith: "The Witcher", keep: "The Witcher" },
  { startsWith: "Resident Evil", keep: "Resident Evil" },
  { startsWith: "Portal", keep: "Portal" },
  { startsWith: "Final Fantasy", keep: "Final Fantasy" },
  { startsWith: "Half-Life", keep: "Half-Life" },
  { startsWith: "Age of Empires", keep: "Age of Empires" },
  { startsWith: "Fallout", keep: "Fallout" },
  { startsWith: "Need for Speed", keep: "Need for Speed" },
  { startsWith: "Red Dead Redemption", keep: "Red Dead Redemption" }
];

main();

function main() {
  const markdown = fs.readFileSync(REVIEW_FILE, "utf8");
  const { header, cards } = parseReviewMarkdown(markdown);
  const filteredCards: ReviewCard[] = [];
  const seenTitles = new Set<string>();

  for (const card of cards) {
    if (isDeleteMarker(card.keepLine)) continue;
    const qId = card.title.match(/^Q\d+$/)?.[0];
    if (qId && Q_DELETE_IDS.has(qId)) continue;
    if (qId && Q_RENAMES[qId]) {
      card.title = Q_RENAMES[qId].title;
      card.description = Q_RENAMES[qId].description;
      card.source = `http://www.wikidata.org/entity/${qId}`;
    }
    const normalizedTitle = normalizeTitle(card.title);
    if (DELETE_TITLES.has(normalizeSpacing(card.title))) continue;
    if (seenTitles.has(normalizedTitle)) continue;
    if (isGameSequelOrDuplicate(card.title)) continue;
    card.description = improveDescription(card.title, card.description);
    if (DESCRIPTION_OVERRIDES[normalizeSpacing(card.title)]) card.source = "curated-description";
    seenTitles.add(normalizedTitle);
    filteredCards.push(card);
  }
  for (const [title, details] of Object.entries(ORIGINAL_CARDS)) {
    const existing = filteredCards.find((card) => normalizeTitle(card.title) === normalizeTitle(title));
    if (existing) {
      existing.description = details.description;
      existing.source = details.source;
      continue;
    }
    filteredCards.push({
      keepLine: "- [x] Keep",
      category: "fiction_games",
      title,
      description: details.description,
      source: details.source
    });
  }

  fs.writeFileSync(REVIEW_FILE, renderReviewMarkdown(header, filteredCards));
  updateCandidatesJson(filteredCards);
  updateReadme(filteredCards.length);

  console.log(`Fiction & Games cards: ${cards.length} -> ${filteredCards.length}`);
  console.log(`Removed sequel/duplicate cards: ${cards.length - filteredCards.length}`);
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
    category: readField(lines, "Category") || "fiction_games",
    title: readField(lines, "Title") || lines[0].replace(/^##\s+/, "").trim(),
    description: readField(lines, "Description"),
    source: readField(lines, "Source")
  };
}

function readField(lines: string[], field: string) {
  return lines.find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2).trim() ?? "";
}

function isGameSequelOrDuplicate(title: string) {
  const cleanTitle = normalizeSpacing(title);
  for (const rule of SERIES_RULES) {
    if (!cleanTitle.startsWith(rule.startsWith)) continue;
    return cleanTitle !== rule.keep;
  }
  if (/\bWarcraft\b/i.test(cleanTitle) && cleanTitle !== "Warcraft: Orcs & Humans") return true;
  return false;
}

function isDeleteMarker(keepLine: string) {
  return /\bdelete\b/i.test(keepLine);
}

function improveDescription(title: string, description: string) {
  const cleanTitle = normalizeSpacing(title);
  const override = DESCRIPTION_OVERRIDES[cleanTitle];
  if (override) return override;

  const desc = normalizeSpacing(description).replace(/\.$/, "");
  if (/fictional character from Star Wars|fictional character in Star Wars|Star Wars universe/i.test(desc)) {
    return "A Star Wars character tied to Jedi, Sith, spaceships, lightsabers, and the galaxy far, far away.";
  }
  if (/Marvel Comics/i.test(desc)) {
    return "A Marvel Comics character tied to superheroes, costumes, powers, and comic-book action.";
  }
  if (/DC Comics/i.test(desc)) {
    return "A DC Comics character tied to capes, villains, secret identities, and comic-book drama.";
  }
  if (/The Simpsons/i.test(desc)) {
    return "A Simpsons character from Springfield's yellow cartoon family and neighborhood.";
  }
  if (/Naruto/i.test(desc)) {
    return "A Naruto character tied to ninja villages, jutsu, rivalries, and anime battles.";
  }
  if (/Friends/i.test(desc)) {
    return "A Friends sitcom character tied to Central Perk, apartments, jokes, and New York hangouts.";
  }
  if (/South Park/i.test(desc)) {
    return "A South Park character tied to crude jokes, snowy Colorado, and chaotic grade-school adventures.";
  }
  if (/Disney cartoon character/i.test(desc)) {
    return "A classic Disney cartoon character with an instantly recognizable animated look and personality.";
  }
  if (/cartoon fictional character/i.test(desc)) {
    return "A classic cartoon character with exaggerated expressions, slapstick energy, and an easy-to-act-out style.";
  }
  if (/^fictional character\.?$/i.test(description)) {
    return "A recognizable fictional character with a distinctive look, personality, or story role.";
  }
  if (/^(\d{4} )?.*video game/i.test(desc)) {
    const withoutYear = desc.replace(/^\d{4}\s+/, "");
    return `A ${withoutYear} with a recognizable title, gameplay style, and clue-friendly gaming references.`;
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
  const fictionTitles = new Map(cards.map((card) => [normalizeTitle(card.title), card]));
  const existingFictionTitles = new Set(
    candidates.filter((candidate) => candidate.category === "fiction_games").map((candidate) => normalizeTitle(candidate.title))
  );
  const nextCandidates = candidates
    .filter((candidate) => candidate.category !== "fiction_games" || fictionTitles.has(normalizeTitle(candidate.title)))
    .map((candidate) => {
      if (candidate.category !== "fiction_games") return candidate;
      const reviewedCard = fictionTitles.get(normalizeTitle(candidate.title));
      if (!reviewedCard) return candidate;
      return {
        ...candidate,
        status: reviewedCard.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
        title: normalizeSpacing(reviewedCard.title),
        description: reviewedCard.description,
        source: reviewedCard.source
      };
    });
  for (const card of cards) {
    if (existingFictionTitles.has(normalizeTitle(card.title))) continue;
    nextCandidates.push({
      status: card.keepLine.includes("[x]") ? "KEEP" : "REMOVE",
      category: "fiction_games",
      categoryLabel: "Fiction & Games",
      id: `fiction_games-${slugify(card.title)}`,
      title: normalizeSpacing(card.title),
      description: card.description,
      source: card.source
    });
  }
  fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(nextCandidates, null, 2)}\n`);
}

function updateReadme(fictionCount: number) {
  if (!fs.existsSync(README_FILE)) return;
  const markdown = fs.readFileSync(README_FILE, "utf8");
  fs.writeFileSync(README_FILE, markdown.replace(/(\| fiction-games\.md \| 57 \| 440 \| )\d+(\s*\|)/, `$1${fictionCount}$2`));
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
