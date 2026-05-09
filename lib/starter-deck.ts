import { TMDB_DECK } from "./tmdb-deck";
import { WIKIPEDIA_DECK } from "./wikipedia-deck";
import { CATEGORY_EXPANSION_DECK } from "./category-expansion-deck";
import { FAMILY_DECK } from "./family-deck";
import { TARGET_FILL_DECK, TARGET_FILL_FAMILY_CARD_IDS } from "./target-fill-deck";

export type StarterDeckCard = {
  id: string;
  title: string;
  description: string;
  category?: string;
};

const CORE_DECK: StarterDeckCard[] = [
  { id: "amelia-earhart", title: "Amelia Earhart", description: "A pioneering pilot who became famous for record-setting flights and her mysterious disappearance over the Pacific." },
  { id: "apollo-11", title: "Apollo 11", description: "The NASA mission that first landed humans on the Moon in 1969." },
  { id: "beyonce", title: "Beyonce", description: "A global pop star known for huge concerts, precise choreography, and songs like Single Ladies and Halo." },
  { id: "bigfoot", title: "Bigfoot", description: "A legendary hairy creature said to live in remote North American forests." },
  { id: "bob-ross", title: "Bob Ross", description: "A calm television painter famous for landscapes, soft encouragement, and happy little trees." },
  { id: "cleopatra", title: "Cleopatra", description: "The last active pharaoh of ancient Egypt, remembered for political skill and alliances with Rome." },
  { id: "darth-vader", title: "Darth Vader", description: "The masked Star Wars villain with a deep voice, heavy breathing, and a red lightsaber." },
  { id: "dolly-parton", title: "Dolly Parton", description: "A country music icon, actor, philanthropist, and the creator of songs like Jolene and 9 to 5." },
  { id: "eiffel-tower", title: "The Eiffel Tower", description: "The famous iron landmark in Paris that looks like a giant lattice tower." },
  { id: "elvis-presley", title: "Elvis Presley", description: "The rock and roll singer known for big stage moves, rhinestone jumpsuits, and a huge cultural footprint." },
  { id: "frida-kahlo", title: "Frida Kahlo", description: "A Mexican painter known for vivid self-portraits, flowers, symbolism, and a distinctive personal style." },
  { id: "george-washington", title: "George Washington", description: "The first president of the United States and a general during the American Revolution." },
  { id: "godzilla", title: "Godzilla", description: "A giant movie monster who stomps through cities and blasts atomic energy." },
  { id: "harriet-tubman", title: "Harriet Tubman", description: "An abolitionist who helped enslaved people escape through the Underground Railroad." },
  { id: "hermione-granger", title: "Hermione Granger", description: "The brilliant Harry Potter character known for studying, spells, and helping solve nearly every problem." },
  { id: "jane-goodall", title: "Jane Goodall", description: "A scientist famous for studying chimpanzees and advocating for wildlife conservation." },
  { id: "jaws", title: "Jaws", description: "The shark from the classic thriller movie, usually announced by ominous music." },
  { id: "mario", title: "Mario", description: "The mustached Nintendo plumber who jumps on enemies, collects coins, and rescues Princess Peach." },
  { id: "mona-lisa", title: "The Mona Lisa", description: "Leonardo da Vinci's famous portrait with the small mysterious smile." },
  { id: "oprah-winfrey", title: "Oprah Winfrey", description: "A talk show host, producer, and media figure known for interviews and audience giveaways." },
  { id: "picasso", title: "Pablo Picasso", description: "A Spanish artist associated with Cubism and bold, fragmented portraits." },
  { id: "queen-elizabeth-ii", title: "Queen Elizabeth II", description: "The long-reigning British monarch known for formal waves, bright outfits, and royal ceremonies." },
  { id: "sherlock-holmes", title: "Sherlock Holmes", description: "A fictional detective who solves mysteries with sharp observation and deduction." },
  { id: "spider-man", title: "Spider-Man", description: "The superhero who swings between buildings, climbs walls, and says great power brings responsibility." },
  { id: "taylor-swift", title: "Taylor Swift", description: "A singer-songwriter known for eras, devoted fans, and albums that span country, pop, and folk styles." },
  { id: "the-beatles", title: "The Beatles", description: "The British band behind songs like Hey Jude, Yesterday, and Here Comes the Sun." },
  { id: "the-rock", title: "The Rock", description: "Dwayne Johnson, a wrestler turned movie star known for charisma, muscles, and one raised eyebrow." },
  { id: "t-rex", title: "T. rex", description: "A massive meat-eating dinosaur with huge teeth, tiny arms, and a starring role in museum displays." },
  { id: "willy-wonka", title: "Willy Wonka", description: "The eccentric candy maker who runs a fantastical chocolate factory." },
  { id: "yoda", title: "Yoda", description: "The small green Jedi master known for wisdom, unusual sentence order, and teaching Luke Skywalker." },
  { id: "zeus", title: "Zeus", description: "The Greek god of thunder, lightning, and ruling the Olympian gods." },
  { id: "airport-security", title: "Airport Security", description: "The checkpoint routine of bins, scanners, shoes, bags, and hoping nobody forgot a water bottle." },
  { id: "alien-job-interview", title: "An Alien at a Job Interview", description: "A strange visitor trying to explain their skills, work history, and why they are qualified on Earth." },
  { id: "baby-shark", title: "Baby Shark", description: "The children's song with repetitive hand motions that can get stuck in your head instantly." },
  { id: "bad-gps", title: "A Bad GPS", description: "A navigation voice giving directions at exactly the wrong time or sending everyone the wrong way." },
  { id: "birthday-cake", title: "Birthday Cake", description: "A celebration dessert with candles, singing, and someone trying to cut equal slices." },
  { id: "black-friday", title: "Black Friday", description: "The shopping day known for discounts, crowds, carts, and people hunting for deals." },
  { id: "broken-umbrella", title: "A Broken Umbrella", description: "An umbrella that flips inside out, refuses to open, or makes rain feel personally targeted." },
  { id: "cactus", title: "Cactus", description: "A prickly desert plant that stores water and strongly discourages hugs." },
  { id: "celebrity-chef", title: "A Celebrity Chef", description: "A famous cook dramatically tasting food, shouting instructions, or presenting a perfect dish." },
  { id: "coffee-shop-wifi", title: "Coffee Shop Wi-Fi", description: "The shared internet connection everyone needs, often protected by a password on a tiny receipt." },
  { id: "courtroom-objection", title: "Courtroom Objection", description: "A dramatic legal interruption where someone stands up and challenges what was just said." },
  { id: "dad-joke", title: "Dad Joke", description: "A painfully obvious pun delivered with confidence and usually followed by groans." },
  { id: "dance-battle", title: "Dance Battle", description: "A face-off where people answer each other with bigger and stranger dance moves." },
  { id: "dentist-chair", title: "Dentist Chair", description: "The reclining chair where small talk becomes impossible because someone is examining your teeth." },
  { id: "elevator-small-talk", title: "Elevator Small Talk", description: "The awkward conversation squeezed into a short ride between floors." },
  { id: "escape-room", title: "Escape Room", description: "A timed puzzle game where a group searches for clues and overthinks every lock." },
  { id: "family-road-trip", title: "Family Road Trip", description: "A long car ride with snacks, arguments over music, and repeated questions about arrival time." },
  { id: "fashion-runway", title: "Fashion Runway", description: "A dramatic walk showing off clothing while cameras flash and everyone looks serious." },
  { id: "fire-drill", title: "Fire Drill", description: "A practice evacuation with alarms, lines, confusion, and someone still carrying coffee." },
  { id: "fortune-cookie", title: "Fortune Cookie", description: "A crisp cookie with a tiny paper message that sounds wise or oddly specific." },
  { id: "garage-band", title: "Garage Band", description: "A loud beginner band practicing with enthusiasm, questionable timing, and big dreams." },
  { id: "haunted-house", title: "Haunted House", description: "A spooky place full of creaky doors, jump scares, and people insisting they are not scared." },
  { id: "hot-air-balloon", title: "Hot Air Balloon", description: "A floating basket lifted by a huge balloon and bursts of flame." },
  { id: "ice-cream-truck", title: "Ice Cream Truck", description: "A vehicle playing cheerful music while selling frozen treats to a suddenly excited neighborhood." },
  { id: "karaoke-night", title: "Karaoke Night", description: "A public singalong where confidence often matters more than hitting the right notes." },
  { id: "lost-luggage", title: "Lost Luggage", description: "The travel nightmare where your suitcase goes somewhere else and you hope it returns." },
  { id: "magic-trick", title: "Magic Trick", description: "A performance where something disappears, reappears, or makes everyone ask how it happened." },
  { id: "mall-santa", title: "Mall Santa", description: "A holiday photo setup where children meet Santa in the middle of a shopping mall." },
  { id: "mime-stuck-in-box", title: "Mime Stuck in a Box", description: "The classic silent act of feeling invisible walls with exaggerated hands." },
  { id: "office-printer", title: "Office Printer", description: "The machine that jams, beeps, needs toner, and becomes everyone's shared problem." },
  { id: "opera-singer", title: "Opera Singer", description: "A performer using a powerful classical voice that can fill a theater." },
  { id: "parking-ticket", title: "Parking Ticket", description: "The unpleasant slip of paper that says your car sat in the wrong place too long." },
  { id: "pirate-captain", title: "Pirate Captain", description: "A ship leader with treasure maps, dramatic orders, and possibly an eye patch." },
  { id: "pizza-delivery", title: "Pizza Delivery", description: "The hopeful moment when hot pizza arrives at the door, ideally still on time." },
  { id: "prom-posal", title: "Promposal", description: "An elaborate or funny public invitation asking someone to go to prom." },
  { id: "reality-show-villain", title: "Reality Show Villain", description: "The cast member edited to cause drama, deliver suspicious confessionals, and stir the pot." },
  { id: "roller-coaster", title: "Roller Coaster", description: "A fast amusement park ride with climbs, drops, loops, and loud screaming." },
  { id: "school-picture-day", title: "School Picture Day", description: "The annual photo ritual with stiff poses, bright backgrounds, and one chance to smile normally." },
  { id: "secret-agent", title: "Secret Agent", description: "A spy doing missions, hiding gadgets, and acting casual while everything is suspicious." },
  { id: "silent-disco", title: "Silent Disco", description: "A dance party where people wear headphones and the room sounds strange without the music." },
  { id: "speed-dating", title: "Speed Dating", description: "A quick series of mini-dates where people try to make an impression in minutes." },
  { id: "spelling-bee", title: "Spelling Bee", description: "A competition where contestants spell difficult words out loud under pressure." },
  { id: "summer-camp", title: "Summer Camp", description: "A seasonal getaway with cabins, games, songs, activities, and possibly homesick campers." },
  { id: "surprise-party", title: "Surprise Party", description: "A secret celebration where everyone hides, waits, and hopes the guest of honor is actually surprised." },
  { id: "taco-truck", title: "Taco Truck", description: "A food truck serving tacos, usually with a line of people who know exactly what they want." },
  { id: "talent-show", title: "Talent Show", description: "A performance event where people sing, dance, juggle, or reveal unexpected skills." },
  { id: "taxi-driver", title: "Taxi Driver", description: "A driver navigating traffic, routes, passengers, and possibly strong opinions about the city." },
  { id: "tech-support", title: "Tech Support", description: "The person asking whether everything is plugged in and suggesting a restart." },
  { id: "theme-park-map", title: "Theme Park Map", description: "A folded guide that promises clarity while everyone argues about where to go next." },
  { id: "thunderstorm", title: "Thunderstorm", description: "A weather event with rain, lightning, thunder, and dramatic window watching." },
  { id: "time-traveler", title: "Time Traveler", description: "Someone visiting another era and trying not to change history too much." },
  { id: "treasure-map", title: "Treasure Map", description: "A map marked with clues, dotted lines, and an X where riches are supposed to be buried." },
  { id: "trivia-host", title: "Trivia Host", description: "The person reading questions, judging answers, and keeping score during quiz night." },
  { id: "valet-parking", title: "Valet Parking", description: "Handing over your car keys and trusting someone else to park the vehicle." },
  { id: "vending-machine", title: "Vending Machine", description: "A snack machine that sometimes drops treats and sometimes traps them behind the glass." },
  { id: "wedding-dj", title: "Wedding DJ", description: "The music wrangler balancing dance hits, announcements, and someone's very specific song request." },
  { id: "yoga-class", title: "Yoga Class", description: "A group exercise session with poses, breathing, mats, and people trying not to fall over." },
  { id: "zombie-apocalypse", title: "Zombie Apocalypse", description: "A survival scenario with slow monsters, barricades, supplies, and questionable group decisions." }
];

const SPORTS_CARD_PATTERNS = [
  /\bbasketball\b/,
  /\bbaseball\b/,
  /\bfootball\b/,
  /\bsoccer\b/,
  /\btennis\b/,
  /\bolympic\b/,
  /\bnba\b/,
  /\bnfl\b/,
  /\bmlb\b/,
  /\bwnba\b/,
  /\bquarterback\b/,
  /\bworld cup\b/,
  /\blakers\b/,
  /\bdodgers\b/,
  /\byankees\b/,
  /\bchiefs\b/,
  /\bgrand slam\b/,
  /\bsprinter\b/,
  /\bswimmer\b/,
  /\bskateboard/,
  /\bwrestl/,
  /\bathlete\b/,
  /\bsports analyst\b/,
  /\bracing\b/,
  /\brace car\b/,
  /\bformula one\b/,
  /\bf1\b/,
  /\bnascar\b/,
  /\bgolf\b/,
  /\bhockey\b/,
  /\bboxing\b/,
  /\bmma\b/,
  /\bsurfing\b/,
  /\bmotorsport\b/,
  /\bgrand prix\b/
];

export const STARTER_DECK: StarterDeckCard[] = [
  ...CORE_DECK,
  ...FAMILY_DECK,
  ...TMDB_DECK,
  ...WIKIPEDIA_DECK,
  ...CATEGORY_EXPANSION_DECK,
  ...TARGET_FILL_DECK
].filter((card) => !isSportsCard(card));

const STARTER_DECK_CARD_IDS = new Set(STARTER_DECK.map((card) => card.id));
const FAMILY_DECK_CARD_IDS = new Set(FAMILY_DECK.map((card) => card.id));

export function isStarterDeckCardAllowed(cardId: string) {
  return STARTER_DECK_CARD_IDS.has(cardId);
}

export function isFamilyFriendlyCard(cardId: string) {
  return FAMILY_DECK_CARD_IDS.has(cardId) || TARGET_FILL_FAMILY_CARD_IDS.has(cardId);
}

function isSportsCard(card: StarterDeckCard) {
  if (card.category === "sports") return true;
  if (card.id.startsWith("tmdb-movie-")) return false;

  const text = `${card.id} ${card.title} ${card.description}`.toLowerCase();
  return SPORTS_CARD_PATTERNS.some((pattern) => pattern.test(text));
}
