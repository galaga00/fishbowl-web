import fs from "node:fs";
import path from "node:path";

type ReviewCard = {
  title: string;
  description: string;
};

type ReviewCategory = {
  file: string;
  label: string;
  category: string;
  cards: ReviewCard[];
};

const OUTPUT_DIR = path.join("card-review", "target-fill");
const SOURCE = "curated-new-category-review";

const categories: ReviewCategory[] = [
  {
    file: "food-drink.md",
    label: "Food & Drink",
    category: "food_drink",
    cards: [
      { title: "Pizza", description: "A round baked dish with crust, sauce, cheese, and toppings cut into slices." },
      { title: "Sushi", description: "Bite-sized Japanese rice rolls or pieces often served with fish, seaweed, soy sauce, and wasabi." },
      { title: "Taco", description: "A folded tortilla filled with meat, beans, vegetables, salsa, cheese, or other toppings." },
      { title: "Burger", description: "A sandwich built around a patty in a bun, usually with lettuce, tomato, cheese, and condiments." },
      { title: "French fries", description: "Thin strips of potato fried until crisp and often dipped in ketchup or sauce." },
      { title: "Ice cream", description: "A frozen sweet dessert served in scoops, cones, cups, sundaes, or milkshakes." },
      { title: "Pancakes", description: "Flat breakfast cakes cooked on a griddle and often stacked with butter and syrup." },
      { title: "Waffles", description: "Crisp grid-patterned breakfast cakes with pockets for syrup, fruit, or whipped cream." },
      { title: "Spaghetti", description: "Long pasta noodles usually twirled around a fork and served with sauce." },
      { title: "Ramen", description: "A noodle soup with broth, toppings, and a steaming bowl built for slurping." },
      { title: "Curry", description: "A richly spiced dish with sauce, vegetables, meat, or legumes often served with rice." },
      { title: "Burrito", description: "A large rolled tortilla stuffed with fillings like rice, beans, meat, cheese, and salsa." },
      { title: "Nachos", description: "Tortilla chips piled with melted cheese, salsa, jalapenos, beans, or other toppings." },
      { title: "Donut", description: "A ring-shaped or filled fried pastry often glazed, frosted, or covered in sprinkles." },
      { title: "Cupcake", description: "A small individual cake baked in a paper liner and topped with frosting." },
      { title: "Wedding cake", description: "A tall decorated cake cut at a wedding, often stacked in tiers with frosting and flowers." },
      { title: "Popcorn", description: "Puffed corn kernels eaten by the handful, especially during movies or games." },
      { title: "Hot dog", description: "A sausage served in a long bun with toppings like mustard, ketchup, onions, or relish." },
      { title: "Sandwich", description: "Fillings such as meat, cheese, vegetables, or spreads layered between slices of bread." },
      { title: "Grilled cheese", description: "A toasted sandwich with melted cheese stretching between buttery slices of bread." },
      { title: "Chicken wings", description: "Small pieces of chicken tossed in sauce and eaten with fingers, often with napkins nearby." },
      { title: "Fried rice", description: "Rice stir-fried with vegetables, egg, sauce, and sometimes meat or tofu." },
      { title: "Dumplings", description: "Small pockets of dough filled with savory ingredients and steamed, boiled, or pan-fried." },
      { title: "Quesadilla", description: "A tortilla folded around melted cheese and fillings, then cooked until warm and crisp." },
      { title: "Pho", description: "A Vietnamese noodle soup with fragrant broth, herbs, rice noodles, and thin slices of meat." },
      { title: "Bagel", description: "A chewy ring-shaped bread often sliced and topped with cream cheese." },
      { title: "Pretzel", description: "A twisted bread snack with a salty crust, often soft and warm or small and crunchy." },
      { title: "Croissant", description: "A flaky crescent-shaped pastry with buttery layers and a crisp golden outside." },
      { title: "Cinnamon roll", description: "A spiral pastry swirled with cinnamon sugar and often covered in icing." },
      { title: "Chocolate chip cookie", description: "A sweet cookie dotted with chocolate chips and usually best when warm." },
      { title: "Brownie", description: "A dense chocolate dessert square with a fudgy middle or cakey crumb." },
      { title: "Apple pie", description: "A baked pie filled with sliced apples, cinnamon, and a flaky crust." },
      { title: "Guacamole", description: "A creamy avocado dip often mixed with lime, salt, onion, tomato, or cilantro." },
      { title: "Salsa", description: "A chunky or smooth sauce made with tomatoes, peppers, onions, herbs, and spice." },
      { title: "Hummus", description: "A creamy chickpea dip blended with tahini, lemon, garlic, and olive oil." },
      { title: "Avocado toast", description: "Toast topped with mashed avocado and extras like egg, chili flakes, or lemon." },
      { title: "Smoothie", description: "A blended drink made from fruit, yogurt, milk, juice, ice, or greens." },
      { title: "Milkshake", description: "A thick cold drink blended from ice cream and milk, often topped with whipped cream." },
      { title: "Coffee", description: "A hot or iced caffeinated drink brewed from roasted beans and served black or with milk." },
      { title: "Espresso", description: "A small strong shot of coffee with a concentrated flavor and thin crema on top." },
      { title: "Bubble tea", description: "A sweet tea drink with chewy tapioca pearls sipped through a wide straw." },
      { title: "Lemonade", description: "A tart sweet drink made with lemon juice, water, and sugar, often served cold." },
      { title: "Hot chocolate", description: "A warm chocolate drink often topped with whipped cream or marshmallows." },
      { title: "Soda", description: "A fizzy sweet drink from a can, bottle, fountain, or fast-food cup." },
      { title: "Tea", description: "A hot or iced drink brewed from leaves and served plain, sweetened, or with milk." },
      { title: "Orange juice", description: "A bright citrus drink squeezed from oranges, commonly served at breakfast." },
      { title: "Watermelon", description: "A large green melon with juicy red flesh, black seeds, and picnic-slice energy." },
      { title: "Strawberry", description: "A small red berry with seeds on the outside and a sweet tart flavor." },
      { title: "Banana", description: "A curved yellow fruit peeled from the top and eaten as a quick snack." },
      { title: "Pineapple", description: "A tropical fruit with a spiky outside, leafy crown, and sweet golden chunks." },
      { title: "Pickle", description: "A cucumber preserved in brine, known for crunch, sour flavor, and sandwich spears." },
      { title: "Hot sauce", description: "A spicy condiment poured in drops or splashes to add heat to food." },
      { title: "Ketchup", description: "A red tomato condiment squeezed onto fries, burgers, hot dogs, or nuggets." },
      { title: "Peanut butter", description: "A thick nutty spread used on sandwiches, toast, crackers, and apples." },
      { title: "Mac and cheese", description: "Pasta covered in creamy melted cheese sauce, often baked or served from a pot." }
    ]
  },
  {
    file: "sports.md",
    label: "Sports",
    category: "sports",
    cards: [
      { title: "Soccer", description: "A global sport where players kick a ball toward goals while avoiding hands." },
      { title: "Basketball", description: "A court sport where teams dribble, pass, and shoot a ball through a hoop." },
      { title: "Baseball", description: "A bat-and-ball sport with pitching, hitting, bases, gloves, and home runs." },
      { title: "Football", description: "An American field sport with touchdowns, helmets, passing, blocking, and yard lines." },
      { title: "Tennis", description: "A racket sport where players hit a ball over a net inside court lines." },
      { title: "Golf", description: "A sport where players use clubs to hit a ball into distant holes in as few strokes as possible." },
      { title: "Swimming", description: "A race or exercise in water using strokes like freestyle, backstroke, breaststroke, and butterfly." },
      { title: "Track and field", description: "A collection of running, jumping, and throwing events often held in a stadium." },
      { title: "Gymnastics", description: "A sport built around flips, balance, strength, and routines on mats or apparatus." },
      { title: "Volleyball", description: "A team sport where players bump, set, and spike a ball over a net." },
      { title: "Hockey", description: "A fast sport played with sticks, a puck or ball, goals, and quick skating or running." },
      { title: "Boxing", description: "A combat sport where gloved fighters punch, block, dodge, and work inside a ring." },
      { title: "Wrestling", description: "A grappling sport focused on takedowns, holds, pins, and body control." },
      { title: "Skateboarding", description: "A board sport with rolling, balancing, ramps, tricks, and wheels underfoot." },
      { title: "Surfing", description: "A water sport where riders balance on a board while catching ocean waves." },
      { title: "Skiing", description: "A snow sport where riders glide downhill or across trails on two long skis." },
      { title: "Snowboarding", description: "A snow sport where riders stand sideways on one board and carve down slopes." },
      { title: "Cycling", description: "A sport or activity built around pedaling bikes on roads, tracks, trails, or hills." },
      { title: "Bowling", description: "A lane game where players roll a heavy ball to knock down pins." },
      { title: "Table tennis", description: "A quick paddle game played on a small table with a lightweight bouncing ball." },
      { title: "Badminton", description: "A racket sport where players hit a feathered shuttlecock back and forth over a net." },
      { title: "Rugby", description: "A rough team sport with running, tackling, passing backward, and carrying an oval ball." },
      { title: "Cricket match", description: "A bat-and-ball contest with wickets, bowlers, batters, fielders, and long innings." },
      { title: "Pickleball", description: "A paddle sport combining tennis-like courts, a plastic ball, and quick net play." },
      { title: "Marathon", description: "A long-distance running race of 26.2 miles, known for endurance and finish lines." },
      { title: "Relay race", description: "A team race where runners pass a baton from one teammate to the next." },
      { title: "Penalty kick", description: "A soccer shot taken from the penalty spot with only the goalkeeper to beat." },
      { title: "Free throw", description: "An uncontested basketball shot from the line after a foul." },
      { title: "Home run", description: "A baseball hit that lets the batter circle all the bases and score." },
      { title: "Touchdown", description: "A football score made by carrying or catching the ball in the end zone." },
      { title: "Slam dunk", description: "A basketball shot where a player jumps and forcefully puts the ball through the hoop." },
      { title: "Goalkeeper", description: "The player who guards the goal and tries to stop shots from scoring." },
      { title: "Referee", description: "The official who watches the game, blows the whistle, and enforces the rules." },
      { title: "Whistle", description: "A small loud tool used by referees, coaches, and lifeguards to stop or signal play." },
      { title: "Scoreboard", description: "The display that shows the score, clock, period, inning, or other game information." },
      { title: "Trophy", description: "A shiny prize awarded to winners, often lifted overhead after a championship." },
      { title: "Medal", description: "A round award worn on a ribbon for finishing first, second, third, or completing an event." },
      { title: "Podium", description: "The raised platform where top finishers stand for medals and photos." },
      { title: "Stadium", description: "A large venue with seats around a field, court, track, or ice surface." },
      { title: "Jersey", description: "A sports shirt with team colors, a number, and sometimes a player's name." },
      { title: "Sneakers", description: "Athletic shoes used for running, jumping, training, and everyday sports style." },
      { title: "Helmet", description: "Protective headgear used in sports like football, hockey, cycling, and skiing." },
      { title: "Baseball bat", description: "A wooden or metal club swung to hit pitched baseballs." },
      { title: "Tennis racket", description: "A handled frame with strings used to hit a tennis ball." },
      { title: "Golf club", description: "A long-handled club used to drive, chip, or putt a golf ball." },
      { title: "Soccer ball", description: "A round patterned ball kicked, passed, trapped, and shot in soccer." },
      { title: "Basketball hoop", description: "A raised rim with a net where basketball players aim their shots." },
      { title: "Skateboard", description: "A short board with four wheels used for riding, tricks, ramps, and street skating." },
      { title: "Michael Jordan", description: "A globally famous basketball legend known for championships, soaring dunks, and the number 23." },
      { title: "World Cup", description: "A major international tournament where national teams compete for one of sports' biggest trophies." },
      { title: "Muhammad Ali", description: "A legendary boxer known for speed, charisma, heavyweight titles, and unforgettable confidence." },
      { title: "Simone Biles", description: "A world-famous gymnast known for explosive flips, balance, Olympic medals, and named skills." },
      { title: "Lionel Messi", description: "A globally famous soccer star known for dribbling, scoring, playmaking, and World Cup glory." },
      { title: "LeBron James", description: "A world-famous basketball star known for power, passing, scoring, and long NBA dominance." },
      { title: "Tiger Woods", description: "A globally known golfer famous for clutch putts, red Sunday shirts, and major championships." },
      { title: "Usain Bolt", description: "A world-famous sprinter known for Olympic gold medals, record speed, and lightning-bolt poses." },
      { title: "Olympics", description: "A global multi-sport event with national teams, medals, opening ceremonies, and elite athletes." }
    ]
  },
  {
    file: "science-tech.md",
    label: "Science & Tech",
    category: "science_tech",
    cards: [
      { title: "Solar system", description: "The Sun and the planets, moons, asteroids, and comets that orbit around it." },
      { title: "Earth", description: "Our home planet, known for oceans, continents, atmosphere, weather, and life." },
      { title: "Moon", description: "Earth's natural satellite, visible at night in phases from crescent to full." },
      { title: "Mars", description: "The red planet, known for dusty landscapes, rovers, and dreams of future exploration." },
      { title: "Saturn", description: "A giant planet famous for wide bright rings made of ice and rock." },
      { title: "Black hole", description: "A region of space with gravity so strong that not even light can escape." },
      { title: "Gravity (force)", description: "The force that pulls objects toward each other and keeps feet on the ground." },
      { title: "Telescope", description: "An instrument that makes distant objects like planets, stars, and galaxies easier to see." },
      { title: "Microscope", description: "A tool that magnifies tiny things such as cells, germs, fibers, or crystals." },
      { title: "Robot", description: "A machine designed to move, sense, or perform tasks automatically." },
      { title: "Artificial intelligence", description: "Computer systems that can generate, classify, predict, or respond in ways that seem intelligent." },
      { title: "Smartphone", description: "A pocket computer with a touchscreen, apps, camera, calls, texts, and internet access." },
      { title: "Laptop", description: "A portable computer that folds open with a screen, keyboard, trackpad, and battery." },
      { title: "Wi-Fi", description: "Wireless networking that lets phones, computers, and devices connect to the internet." },
      { title: "Bluetooth", description: "Short-range wireless technology used for earbuds, speakers, keyboards, cars, and controllers." },
      { title: "GPS", description: "Satellite navigation that helps phones, cars, and maps figure out location and directions." },
      { title: "3D printer", description: "A machine that builds physical objects layer by layer from digital designs." },
      { title: "Drone", description: "A remote-controlled or automated flying device with spinning rotors and sometimes a camera." },
      { title: "Electric car", description: "A car powered by batteries and motors instead of a gasoline engine." },
      { title: "Solar panel", description: "A flat panel that converts sunlight into electricity, often seen on roofs or fields." },
      { title: "Wind turbine", description: "A tall machine with huge blades that spin in the wind to generate electricity." },
      { title: "Rocket launch", description: "The fiery liftoff of a spacecraft pushed upward by powerful engines." },
      { title: "Satellite", description: "An object orbiting Earth or another body, used for communication, maps, weather, or science." },
      { title: "Space station", description: "A crewed laboratory orbiting Earth where astronauts live and work in microgravity." },
      { title: "Astronaut", description: "A person trained to travel and work in space, often wearing a bulky suit." },
      { title: "DNA", description: "The molecule that carries genetic instructions, often pictured as a twisting double helix." },
      { title: "Gene", description: "A segment of DNA that influences traits and helps pass information from parents to offspring." },
      { title: "Vaccine", description: "A medical preparation that trains the immune system to recognize and fight disease." },
      { title: "Antibiotic", description: "A medicine used to kill bacteria or slow their growth during infections." },
      { title: "X-ray", description: "A medical image that can show bones and hidden structures inside the body." },
      { title: "MRI scanner", description: "A large medical machine that uses magnets and radio waves to create detailed body images." },
      { title: "Stethoscope", description: "A doctor's listening tool used on the chest or back to hear heartbeats and breathing." },
      { title: "Thermometer", description: "A device that measures temperature, often used to check for fever or weather." },
      { title: "Calculator", description: "A device or app used to add, subtract, multiply, divide, and solve equations." },
      { title: "Keyboard", description: "A set of keys used to type letters, numbers, shortcuts, and commands into a computer." },
      { title: "Computer mouse", description: "A hand-controlled device used to point, click, drag, and scroll on a screen." },
      { title: "Video call", description: "A live conversation where people see and hear each other through screens and cameras." },
      { title: "Cloud storage", description: "Online storage that keeps files accessible from different devices through the internet." },
      { title: "Password", description: "A secret word, phrase, or code used to unlock an account or device." },
      { title: "QR code", description: "A square scannable pattern that opens a link, menu, ticket, or digital information." },
      { title: "Barcode", description: "A striped code scanned at stores to identify products and prices." },
      { title: "Microchip", description: "A tiny electronic circuit that helps computers, cards, phones, and devices process information." },
      { title: "Circuit board", description: "A flat board holding electronic parts and pathways inside computers and gadgets." },
      { title: "Battery", description: "A stored power source used to run phones, toys, cars, remotes, and electronics." },
      { title: "Magnet", description: "An object that pulls on iron and can stick to metal surfaces like a refrigerator." },
      { title: "Laser", description: "A focused beam of light used in scanners, pointers, surgery, cutting, and experiments." },
      { title: "Fiber optic cable", description: "A cable that sends information as pulses of light through thin glass fibers." },
      { title: "Virtual reality headset", description: "A wearable screen system that makes digital worlds surround the viewer." },
      { title: "Augmented reality", description: "Technology that overlays digital objects or labels on the real world through a screen." },
      { title: "Self-driving car", description: "A vehicle designed to steer, brake, and navigate using sensors, cameras, and software." },
      { title: "Smartwatch", description: "A wrist device that tracks time, messages, health data, workouts, and apps." },
      { title: "Streaming service", description: "An online platform for watching shows, movies, or videos without downloading files first." },
      { title: "Search engine", description: "A website that finds pages, images, videos, and answers from across the internet." },
      { title: "Email inbox", description: "The place where digital messages arrive, pile up, get searched, and sometimes get ignored." },
      { title: "Spam filter", description: "Software that tries to catch unwanted messages before they clutter an inbox." },
      { title: "Web browser", description: "An app used to visit websites, open tabs, search, bookmark, and download files." },
      { title: "App store", description: "A digital marketplace for downloading phone, tablet, computer, or TV apps." },
      { title: "Firewall", description: "A security system that helps block unwanted network traffic from reaching a device or server." },
      { title: "Data center", description: "A building full of servers, cables, cooling systems, and backup power for online services." },
      { title: "USB cable", description: "A cable used to charge devices or move data between electronics." },
      { title: "Touchscreen", description: "A display controlled by tapping, swiping, pinching, and pressing directly on the glass." }
    ]
  },
  {
    file: "jobs-hobbies.md",
    label: "Jobs & Hobbies",
    category: "jobs_hobbies",
    cards: [
      { title: "Chef", description: "A professional cook who plans dishes, leads a kitchen, and plates food for guests." },
      { title: "Teacher", description: "A person who leads lessons, explains ideas, grades work, and manages a classroom." },
      { title: "Firefighter", description: "An emergency worker trained to fight fires, rescue people, and use hoses and gear." },
      { title: "Nurse", description: "A healthcare worker who cares for patients, checks vital signs, and helps with treatment." },
      { title: "Doctor", description: "A medical professional who examines patients, diagnoses illness, and recommends treatment." },
      { title: "Dentist", description: "A healthcare professional who cleans, fixes, and checks teeth and gums." },
      { title: "Veterinarian", description: "An animal doctor who treats pets, livestock, and other creatures when they are sick or hurt." },
      { title: "Pilot", description: "A person trained to fly aircraft and guide passengers or cargo through the sky." },
      { title: "Flight attendant", description: "An airline crew member who helps passengers, demonstrates safety, and serves during flights." },
      { title: "Mechanic", description: "A worker who repairs engines, brakes, tires, and other parts of vehicles or machines." },
      { title: "Electrician", description: "A tradesperson who installs and repairs wiring, outlets, lights, panels, and electrical systems." },
      { title: "Plumber", description: "A tradesperson who fixes pipes, sinks, toilets, drains, leaks, and water systems." },
      { title: "Carpenter", description: "A builder who works with wood to make frames, cabinets, furniture, and structures." },
      { title: "Architect", description: "A designer who plans buildings, drawings, layouts, and how spaces should function." },
      { title: "Librarian", description: "A person who organizes books, helps people find information, and manages library spaces." },
      { title: "Photographer", description: "A person who uses a camera to capture portraits, events, products, nature, or news." },
      { title: "Graphic designer", description: "A visual designer who creates logos, layouts, posters, packaging, and digital artwork." },
      { title: "Software developer", description: "A person who writes, tests, and maintains code for apps, websites, or systems." },
      { title: "Barista", description: "A coffee shop worker who makes espresso drinks, pours milk, and calls out orders." },
      { title: "Baker", description: "A person who makes bread, cakes, cookies, pastries, and other oven-baked foods." },
      { title: "Farmer", description: "A person who grows crops, raises animals, and works with land, weather, and equipment." },
      { title: "Gardener", description: "A person who plants, waters, trims, weeds, and cares for flowers, lawns, or vegetables." },
      { title: "Florist", description: "A person who arranges flowers into bouquets, centerpieces, wreaths, and gifts." },
      { title: "Hair stylist", description: "A person who cuts, colors, washes, and styles hair for clients." },
      { title: "Makeup artist", description: "A person who applies cosmetics for photos, performances, weddings, costumes, or everyday looks." },
      { title: "Tailor", description: "A person who alters, repairs, measures, and fits clothing." },
      { title: "Mail carrier", description: "A worker who delivers letters, packages, and mail along a route." },
      { title: "Delivery driver", description: "A driver who brings food, groceries, packages, or supplies to homes and businesses." },
      { title: "Train conductor", description: "A rail worker who checks tickets, helps passengers, and coordinates movement on a train." },
      { title: "Journalist", description: "A person who reports news, interviews sources, researches facts, and writes stories." },
      { title: "News anchor", description: "A broadcaster who presents news stories from a studio or live location." },
      { title: "Weather reporter", description: "A broadcaster who explains forecasts, maps, storms, temperatures, and umbrellas." },
      { title: "Lawyer", description: "A professional who gives legal advice, writes arguments, and represents clients." },
      { title: "Judge", description: "A courtroom official who listens to cases, interprets law, and makes rulings." },
      { title: "Police officer", description: "A public safety worker who responds to calls, enforces laws, and patrols communities." },
      { title: "Security guard", description: "A worker who watches entrances, checks badges, patrols areas, and protects property." },
      { title: "Lifeguard", description: "A trained watcher at a pool or beach who helps swimmers and responds to emergencies." },
      { title: "Coach", description: "A person who trains players, plans practice, gives advice, and leads a team." },
      { title: "Yoga instructor", description: "A teacher who guides breathing, stretching, balance poses, and calm movement." },
      { title: "Personal trainer", description: "A fitness coach who plans workouts, counts reps, and helps with exercise goals." },
      { title: "DJ", description: "A performer who plays, mixes, and transitions music for crowds, parties, or radio." },
      { title: "Singer", description: "A performer who uses their voice for songs, concerts, recordings, or musicals." },
      { title: "Actor", description: "A performer who plays characters on stage, television, film, or in sketches." },
      { title: "Magician", description: "A performer who creates illusions with cards, coins, props, misdirection, and showmanship." },
      { title: "Comedian", description: "A performer who tells jokes, stories, or observations to make an audience laugh." },
      { title: "Painter", description: "A person who creates images or designs using brushes, colors, canvas, walls, or paper." },
      { title: "Sculptor", description: "An artist who shapes clay, stone, metal, wood, or other materials into forms." },
      { title: "Pottery", description: "A hobby or craft that shapes clay into bowls, mugs, plates, and decorative pieces." },
      { title: "Knitting", description: "A yarn craft using needles to make scarves, sweaters, blankets, and soft patterns." },
      { title: "Woodworking", description: "A hobby or trade that cuts, sands, joins, and finishes wood into useful objects." },
      { title: "Birdwatching", description: "A hobby where people identify birds by sight, sound, feathers, and field guides." },
      { title: "Camping", description: "An outdoor hobby with tents, sleeping bags, campfires, flashlights, and nature sounds." },
      { title: "Hiking", description: "Walking trails through parks, forests, hills, or mountains for exercise and views." },
      { title: "Fishing", description: "A hobby using rods, lines, hooks, bait, and patience to catch fish." },
      { title: "Chess club", description: "A group hobby where players meet to play chess, study moves, and compete." },
      { title: "Book club", description: "A group that reads the same book and meets to discuss characters, twists, and opinions." },
      { title: "Karaoke", description: "A hobby or party activity where people sing along to backing tracks and lyrics on a screen." },
      { title: "Scrapbooking", description: "A craft hobby that arranges photos, stickers, paper, captions, and memories into albums." }
    ]
  },
  {
    file: "internet-memes.md",
    label: "Internet & Memes",
    category: "internet_memes",
    cards: [
      { title: "Rickroll", description: "A prank link that unexpectedly sends someone to Rick Astley's Never Gonna Give You Up." },
      { title: "Doge", description: "A Shiba Inu meme with broken-caption phrases like much wow and very funny." },
      { title: "Distracted Boyfriend", description: "A stock-photo meme where a man turns to look at someone else while his girlfriend reacts." },
      { title: "This Is Fine", description: "A comic panel meme where a calm dog sits in a room that is on fire." },
      { title: "Woman Yelling at Cat", description: "A reaction meme pairing an angry reality-TV moment with a confused white cat at dinner." },
      { title: "Drakeposting", description: "A two-panel reaction format where Drake rejects one thing and approves another." },
      { title: "Galaxy Brain", description: "A meme format that shows ideas becoming more absurd as brains glow larger and brighter." },
      { title: "Grumpy Cat", description: "A famous frowning cat meme used for sarcastic, annoyed, or unimpressed captions." },
      { title: "Nyan Cat", description: "A pixel-art flying cat with a Pop-Tart body leaving a rainbow trail." },
      { title: "Among Us sus", description: "A gaming meme about calling someone suspicious, often with colorful crewmates and emergency meetings." },
      { title: "The Backrooms", description: "An internet horror concept about endless yellow rooms, buzzing lights, and unsettling empty spaces." },
      { title: "Skibidi Toilet", description: "A surreal video meme series about singing toilet heads and bizarre escalating battles." },
      { title: "Italian brainrot", description: "A 2025 meme style built around absurd AI-generated animal-object characters with faux-Italian names." },
      { title: "6-7 meme", description: "A 2025 TikTok and Reels meme based on repeating six seven with gestures and chaotic edits." },
      { title: "NPC streaming", description: "A livestream trend where creators repeat game-like catchphrases and motions after receiving gifts." },
      { title: "Girl dinner", description: "A meme about assembling a low-effort snack plate and calling it dinner." },
      { title: "Girl math", description: "A joking meme about funny personal logic used to justify spending or budgeting." },
      { title: "Very demure", description: "A catchphrase meme about presenting something as modest, mindful, polished, or quietly dramatic." },
      { title: "Let him cook", description: "A phrase used when someone wants others to wait and see what a person is making or planning." },
      { title: "Main character energy", description: "A meme phrase for acting like the star of a movie, montage, or dramatic life moment." },
      { title: "Canon event", description: "A meme about an unavoidable life moment that supposedly must happen for character development." },
      { title: "Rizz", description: "Internet slang for charm or flirting ability, often exaggerated in jokes and captions." },
      { title: "Delulu", description: "Internet slang for playful delusion, usually about unrealistic confidence, romance, or plans." },
      { title: "Aura farming", description: "A meme phrase about posing, acting cool, or collecting imaginary style points." },
      { title: "Ohio meme", description: "A meme shorthand for something weird, chaotic, or absurd happening as if only in Ohio." },
      { title: "Sigma face", description: "A reaction meme built around exaggerated serious expressions and lone-wolf confidence jokes." },
      { title: "Chill guy", description: "A laid-back character meme used for calm, unbothered, or low-stress reactions." },
      { title: "Little Miss meme", description: "A format using Little Miss-style characters labeled with oddly specific personality traits." },
      { title: "Spotify Wrapped", description: "An annual music recap that becomes a flood of jokes about taste, habits, and listening stats." },
      { title: "Duolingo owl", description: "A meme about the green language app mascot acting intense about missed lessons." },
      { title: "BeReal notification", description: "A meme about the daily app alert demanding an immediate authentic photo." },
      { title: "Wednesday dance", description: "A viral dance meme inspired by Wednesday Addams with stiff moves and dramatic attitude." },
      { title: "Barbenheimer", description: "A 2023 movie-event meme about pairing Barbie and Oppenheimer as a double feature." },
      { title: "Labubu", description: "A viral collectible toy craze tied to blind boxes, bag charms, and social-media flexes." },
      { title: "POV meme", description: "A caption format where the viewer is placed inside a specific situation or point of view." },
      { title: "Fit check", description: "A social-media format for showing off an outfit from shoes to accessories." },
      { title: "CapCut template", description: "A reusable short-video editing format that spreads through TikTok and Reels trends." },
      { title: "TikTok shop haul", description: "A video trend where someone shows a pile of online purchases and quick product reactions." },
      { title: "Brainrot", description: "Internet slang for absurd, repetitive, or overly online content that gets stuck in your head." },
      { title: "Unhinged PowerPoint night", description: "A party trend where friends present silly slideshow arguments on overly specific topics." },
      { title: "Side eye", description: "A reaction meme for suspicion, judgment, disbelief, or quietly noticing something awkward." },
      { title: "Bombastic side eye", description: "A dramatic version of side eye used for exaggerated judgment or comic disapproval." },
      { title: "Pedro Pascal eating sandwich", description: "A reaction meme showing Pedro Pascal chewing while looking tired, awkward, or emotionally done." },
      { title: "Kevin James shrug", description: "A reaction image of Kevin James smirking and shrugging with sheepish confidence." }
    ]
  }
];

const genericPatterns = [
  /clue about/i,
  /something that/i,
  /someone who/i,
  /somewhere/i,
  /review placeholder/i,
  /candidate \d+/i,
  /easy to describe/i,
  /recognizable .* with/i
];

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const category of categories) {
    validateCategory(category);
    fs.writeFileSync(path.join(OUTPUT_DIR, category.file), renderCategory(category));
    console.log(`Wrote ${category.cards.length} cards to ${category.file}`);
  }
}

function validateCategory(category: ReviewCategory) {
  const seen = new Set<string>();
  for (const card of category.cards) {
    const key = normalize(card.title);
    if (seen.has(key)) throw new Error(`Duplicate title in ${category.file}: ${card.title}`);
    seen.add(key);
    if (genericPatterns.some((pattern) => pattern.test(card.description))) {
      throw new Error(`Generic description in ${category.file}: ${card.title}`);
    }
    if (card.description.length < 45) {
      throw new Error(`Description too short in ${category.file}: ${card.title}`);
    }
  }
}

function renderCategory(category: ReviewCategory) {
  return `# ${category.label} Review

Target total: 440. Current total: 0. Candidate additions: ${category.cards.length}.

How to review:
- Leave \`- [x] Keep\` checked for cards you like.
- Change to \`- [ ] Keep\` to remove a card.
- Edit \`Title:\`, \`Description:\`, or \`Category:\` directly if needed.

${category.cards.map((card) => renderCard(category.category, card)).join("\n")}`;
}

function renderCard(category: string, card: ReviewCard) {
  return `## ${card.title}
- [x] Keep
Category: ${category}
Title: ${card.title}
Description: ${card.description}
Source: ${SOURCE}
`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
}

main();
