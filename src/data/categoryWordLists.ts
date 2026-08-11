/**
 * Category word lists for Category Fluency validation.
 * Words are stored lowercase. Matching uses stemming/fuzzy logic
 * so "doggy" matches "dog", "running" matches "run", etc.
 * 
 * Lists are intentionally generous — we want to accept creative but valid answers.
 */

const ANIMALS = new Set([
  // Common pets
  'dog', 'cat', 'fish', 'bird', 'hamster', 'rabbit', 'bunny', 'turtle', 'parrot',
  'goldfish', 'guinea pig', 'gerbil', 'ferret', 'mouse', 'rat', 'snake', 'lizard',
  'frog', 'toad', 'hermit crab', 'canary', 'parakeet', 'cockatiel', 'chinchilla',
  // Farm animals
  'cow', 'horse', 'pig', 'chicken', 'rooster', 'hen', 'sheep', 'goat', 'donkey',
  'mule', 'duck', 'goose', 'turkey', 'llama', 'alpaca', 'ox', 'bull', 'calf',
  'lamb', 'ram', 'ewe', 'pony', 'mare', 'stallion', 'foal',
  // Wild animals
  'lion', 'tiger', 'bear', 'elephant', 'giraffe', 'zebra', 'monkey', 'gorilla',
  'chimpanzee', 'chimp', 'orangutan', 'hippo', 'hippopotamus', 'rhino', 'rhinoceros',
  'crocodile', 'alligator', 'leopard', 'cheetah', 'panther', 'jaguar', 'wolf',
  'fox', 'deer', 'moose', 'elk', 'caribou', 'antelope', 'gazelle', 'buffalo',
  'bison', 'camel', 'kangaroo', 'koala', 'panda', 'polar bear', 'grizzly',
  'sloth', 'armadillo', 'porcupine', 'hedgehog', 'badger', 'otter', 'beaver',
  'raccoon', 'skunk', 'squirrel', 'chipmunk', 'bat', 'hyena', 'jackal', 'coyote',
  'boar', 'warthog', 'wildebeest', 'baboon', 'lemur', 'meerkat', 'mongoose',
  // Sea animals
  'whale', 'dolphin', 'shark', 'octopus', 'squid', 'jellyfish', 'seahorse',
  'starfish', 'lobster', 'crab', 'shrimp', 'clam', 'oyster', 'seal', 'walrus',
  'penguin', 'orca', 'ray', 'stingray', 'manta', 'eel', 'salmon', 'tuna',
  'trout', 'bass', 'cod', 'swordfish', 'catfish', 'manatee', 'narwhal',
  // Birds
  'eagle', 'hawk', 'falcon', 'owl', 'robin', 'sparrow', 'crow', 'raven',
  'pigeon', 'dove', 'seagull', 'pelican', 'flamingo', 'peacock', 'swan',
  'hummingbird', 'woodpecker', 'toucan', 'stork', 'crane', 'heron', 'cardinal',
  'bluejay', 'ostrich', 'emu', 'vulture', 'condor', 'kingfisher', 'magpie',
  // Insects / small creatures
  'ant', 'bee', 'butterfly', 'moth', 'spider', 'beetle', 'ladybug', 'dragonfly',
  'grasshopper', 'cricket', 'caterpillar', 'worm', 'snail', 'slug', 'fly',
  'mosquito', 'wasp', 'scorpion', 'centipede', 'millipede', 'cockroach', 'firefly',
  // Reptiles / amphibians
  'iguana', 'chameleon', 'gecko', 'python', 'cobra', 'viper', 'rattlesnake',
  'tortoise', 'newt', 'salamander', 'komodo',
]);

const FOODS = new Set([
  // Fruits
  'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'raspberry',
  'cherry', 'peach', 'pear', 'plum', 'mango', 'pineapple', 'watermelon', 'melon',
  'cantaloupe', 'kiwi', 'coconut', 'lemon', 'lime', 'grapefruit', 'fig', 'date',
  'pomegranate', 'papaya', 'guava', 'apricot', 'nectarine', 'tangerine', 'avocado',
  'berry', 'blackberry', 'cranberry',
  // Vegetables
  'carrot', 'broccoli', 'potato', 'tomato', 'onion', 'garlic', 'pepper', 'corn',
  'lettuce', 'spinach', 'cabbage', 'cucumber', 'celery', 'peas', 'beans', 'mushroom',
  'cauliflower', 'asparagus', 'zucchini', 'squash', 'pumpkin', 'eggplant', 'radish',
  'turnip', 'beet', 'artichoke', 'kale', 'okra', 'leek', 'yam', 'sweet potato',
  'green beans', 'black beans', 'bell pepper', 'brussels sprouts', 'bok choy',
  // Grains / Staples
  'bread', 'rice', 'pasta', 'noodles', 'cereal', 'oatmeal', 'pancake', 'waffle',
  'toast', 'bagel', 'muffin', 'croissant', 'tortilla', 'cracker', 'pretzel',
  'biscuit', 'roll', 'flour', 'wheat', 'barley', 'quinoa', 'couscous',
  // Proteins
  'chicken', 'beef', 'pork', 'fish', 'steak', 'bacon', 'sausage', 'ham', 'turkey',
  'lamb', 'shrimp', 'lobster', 'crab', 'salmon', 'tuna', 'egg', 'tofu', 'beans',
  'lentils', 'nuts', 'peanut', 'almond', 'walnut', 'cashew',
  // Dairy
  'milk', 'cheese', 'butter', 'yogurt', 'cream', 'ice cream',
  // Prepared / Common foods
  'pizza', 'hamburger', 'burger', 'sandwich', 'soup', 'salad', 'taco', 'burrito',
  'sushi', 'hot dog', 'fries', 'chips', 'popcorn', 'cookie', 'cake', 'pie',
  'donut', 'doughnut', 'candy', 'chocolate', 'pudding', 'jelly', 'jam',
  'honey', 'syrup', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'sauce', 'gravy',
  'curry', 'chili', 'stew', 'casserole', 'lasagna', 'macaroni',
]);

const COLORS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black',
  'white', 'gray', 'grey', 'gold', 'silver', 'bronze', 'tan', 'beige', 'cream',
  'ivory', 'maroon', 'burgundy', 'crimson', 'scarlet', 'coral', 'salmon', 'peach',
  'rose', 'magenta', 'fuchsia', 'violet', 'lavender', 'lilac', 'plum', 'indigo',
  'navy', 'teal', 'turquoise', 'aqua', 'cyan', 'mint', 'lime', 'olive', 'forest',
  'emerald', 'jade', 'chartreuse', 'khaki', 'rust', 'copper', 'amber', 'mauve',
  'periwinkle', 'cerulean', 'azure', 'cobalt', 'sapphire', 'ruby', 'garnet',
]);

const CLOTHES = new Set([
  'shirt', 'pants', 'jeans', 'shorts', 'dress', 'skirt', 'blouse', 'sweater',
  'jacket', 'coat', 'hoodie', 'sweatshirt', 'vest', 'suit', 'tie', 'bow tie',
  'hat', 'cap', 'beanie', 'scarf', 'gloves', 'mittens', 'socks', 'shoes',
  'boots', 'sandals', 'sneakers', 'slippers', 'heels', 'flip flops', 'belt',
  'underwear', 'bra', 'boxers', 'briefs', 'pajamas', 'robe', 'bathrobe',
  'swimsuit', 'bikini', 'trunks', 'tank top', 'polo', 'cardigan', 'blazer',
  'tuxedo', 'gown', 'uniform', 'apron', 'overalls', 'leggings', 'tights',
  'stockings', 'raincoat', 'windbreaker', 'parka', 'poncho', 'cape', 'shawl',
  'headband', 'bandana', 'earmuffs', 'visor', 'beret', 'fedora', 'bonnet',
  'tunic', 'camisole', 'corset', 'romper', 'jumpsuit', 'overcoat', 'trench',
  'tracksuit', 'jersey', 'sweatpants', 'joggers', 'cargo', 'khakis', 'slacks',
]);

const KITCHEN = new Set([
  'cup', 'mug', 'glass', 'plate', 'bowl', 'fork', 'knife', 'spoon', 'pan',
  'pot', 'skillet', 'wok', 'spatula', 'ladle', 'whisk', 'tongs', 'colander',
  'strainer', 'cutting board', 'oven', 'stove', 'microwave', 'toaster',
  'blender', 'mixer', 'refrigerator', 'fridge', 'freezer', 'dishwasher',
  'sink', 'faucet', 'sponge', 'dish', 'napkin', 'towel', 'apron', 'timer',
  'measuring cup', 'rolling pin', 'peeler', 'grater', 'can opener', 'opener',
  'pitcher', 'kettle', 'teapot', 'coffee maker', 'jar', 'container', 'lid',
  'tray', 'platter', 'baking sheet', 'cookie sheet', 'muffin tin', 'rack',
  'thermometer', 'scale', 'funnel', 'mortar', 'pestle', 'sieve', 'griddle',
  'corkscrew', 'bottle opener', 'trivet', 'mitt', 'oven mitt', 'chopsticks',
  'tablecloth', 'coaster', 'salt shaker', 'pepper mill', 'trash can', 'bin',
  'drawer', 'cabinet', 'shelf', 'counter', 'table', 'stool', 'chair',
]);

const TOOLS = new Set([
  'hammer', 'saw', 'drill', 'screwdriver', 'wrench', 'pliers', 'nail', 'screw',
  'bolt', 'nut', 'washer', 'level', 'tape measure', 'ruler', 'clamp', 'vise',
  'chisel', 'file', 'sandpaper', 'plane', 'axe', 'hatchet', 'shovel', 'rake',
  'hoe', 'pickaxe', 'crowbar', 'pry bar', 'jack', 'ladder', 'scaffold',
  'wheelbarrow', 'bucket', 'paintbrush', 'roller', 'trowel', 'putty knife',
  'wire cutter', 'snips', 'staple gun', 'nail gun', 'rivet', 'soldering iron',
  'blowtorch', 'welder', 'grinder', 'sander', 'jigsaw', 'circular saw',
  'chainsaw', 'table saw', 'miter saw', 'bandsaw', 'lathe', 'router',
  'socket', 'ratchet', 'allen wrench', 'hex key', 'multimeter', 'stud finder',
  'caulk gun', 'utility knife', 'box cutter', 'scissors', 'snips', 'awl',
  'mallet', 'sledgehammer', 'tape', 'duct tape', 'glue', 'epoxy',
]);

const VEHICLES = new Set([
  'car', 'truck', 'bus', 'van', 'suv', 'bike', 'bicycle', 'motorcycle',
  'scooter', 'moped', 'train', 'subway', 'tram', 'trolley', 'taxi', 'cab',
  'ambulance', 'fire truck', 'police car', 'helicopter', 'airplane', 'plane',
  'jet', 'boat', 'ship', 'yacht', 'canoe', 'kayak', 'sailboat', 'ferry',
  'submarine', 'rocket', 'spaceship', 'tractor', 'bulldozer', 'crane',
  'forklift', 'dump truck', 'cement mixer', 'excavator', 'backhoe',
  'snowplow', 'snowmobile', 'atv', 'golf cart', 'go kart', 'segway',
  'skateboard', 'longboard', 'rollerblades', 'wagon', 'sled', 'sleigh',
  'chariot', 'carriage', 'buggy', 'rickshaw', 'gondola', 'blimp', 'zeppelin',
  'hovercraft', 'jet ski', 'motorboat', 'speedboat', 'tanker', 'freighter',
  'cruise ship', 'raft', 'rowboat', 'minivan', 'sedan', 'coupe', 'convertible',
  'limousine', 'limo', 'pickup', 'jeep', 'rv', 'camper', 'trailer',
]);

const JOBS = new Set([
  'doctor', 'nurse', 'teacher', 'driver', 'lawyer', 'judge', 'police',
  'policeman', 'policewoman', 'officer', 'firefighter', 'fireman', 'chef',
  'cook', 'waiter', 'waitress', 'server', 'bartender', 'baker', 'butcher',
  'farmer', 'carpenter', 'plumber', 'electrician', 'mechanic', 'engineer',
  'architect', 'scientist', 'researcher', 'professor', 'librarian', 'counselor',
  'therapist', 'psychologist', 'psychiatrist', 'dentist', 'surgeon', 'vet',
  'veterinarian', 'pharmacist', 'paramedic', 'pilot', 'flight attendant',
  'captain', 'sailor', 'soldier', 'general', 'sergeant', 'detective',
  'investigator', 'spy', 'agent', 'guard', 'security', 'janitor', 'custodian',
  'cleaner', 'housekeeper', 'maid', 'gardener', 'landscaper', 'painter',
  'artist', 'musician', 'singer', 'dancer', 'actor', 'actress', 'director',
  'producer', 'writer', 'author', 'journalist', 'reporter', 'editor',
  'photographer', 'cameraman', 'designer', 'programmer', 'developer',
  'accountant', 'banker', 'broker', 'analyst', 'consultant', 'manager',
  'ceo', 'president', 'mayor', 'governor', 'senator', 'politician',
  'ambassador', 'diplomat', 'translator', 'interpreter', 'tutor', 'coach',
  'trainer', 'referee', 'umpire', 'athlete', 'astronaut', 'barber',
  'hairdresser', 'stylist', 'tailor', 'seamstress', 'jeweler', 'optometrist',
  'chiropractor', 'receptionist', 'secretary', 'clerk', 'cashier', 'salesman',
  'saleswoman', 'realtor', 'broker', 'inspector', 'auditor', 'welder',
  'roofer', 'bricklayer', 'mason', 'trucker', 'courier', 'mailman', 'postman',
]);

const EMOTIONS = new Set([
  'happy', 'sad', 'angry', 'mad', 'scared', 'afraid', 'fearful', 'nervous',
  'anxious', 'worried', 'stressed', 'frustrated', 'annoyed', 'irritated',
  'excited', 'thrilled', 'ecstatic', 'joyful', 'cheerful', 'glad', 'content',
  'satisfied', 'pleased', 'grateful', 'thankful', 'proud', 'confident',
  'brave', 'courageous', 'hopeful', 'optimistic', 'peaceful', 'calm', 'relaxed',
  'serene', 'tranquil', 'comfortable', 'relieved', 'surprised', 'shocked',
  'amazed', 'astonished', 'stunned', 'confused', 'puzzled', 'bewildered',
  'curious', 'interested', 'fascinated', 'bored', 'tired', 'exhausted',
  'sleepy', 'drowsy', 'lonely', 'isolated', 'homesick', 'nostalgic',
  'melancholy', 'depressed', 'gloomy', 'miserable', 'devastated', 'heartbroken',
  'disappointed', 'discouraged', 'hopeless', 'helpless', 'desperate',
  'jealous', 'envious', 'guilty', 'ashamed', 'embarrassed', 'humiliated',
  'disgusted', 'repulsed', 'horrified', 'terrified', 'panicked', 'hysterical',
  'furious', 'enraged', 'livid', 'bitter', 'resentful', 'hostile', 'aggressive',
  'loving', 'affectionate', 'caring', 'compassionate', 'sympathetic', 'empathetic',
  'tender', 'warm', 'passionate', 'romantic', 'playful', 'silly', 'giddy',
  'amused', 'delighted', 'elated', 'euphoric', 'blissful', 'gloomy',
]);

const SPORTS = new Set([
  'soccer', 'football', 'basketball', 'baseball', 'tennis', 'golf', 'hockey',
  'volleyball', 'cricket', 'rugby', 'boxing', 'wrestling', 'swimming',
  'diving', 'surfing', 'skiing', 'snowboarding', 'skating', 'gymnastics',
  'track', 'running', 'jogging', 'marathon', 'sprinting', 'hurdles',
  'cycling', 'biking', 'rowing', 'sailing', 'canoeing', 'kayaking',
  'fencing', 'archery', 'shooting', 'bowling', 'billiards', 'pool',
  'ping pong', 'table tennis', 'badminton', 'squash', 'racquetball',
  'lacrosse', 'polo', 'water polo', 'handball', 'softball', 'kickball',
  'dodgeball', 'cheerleading', 'dance', 'ballet', 'karate', 'judo',
  'taekwondo', 'kung fu', 'martial arts', 'mma', 'kickboxing', 'yoga',
  'pilates', 'crossfit', 'weightlifting', 'powerlifting', 'bodybuilding',
  'climbing', 'rock climbing', 'bouldering', 'hiking', 'camping', 'fishing',
  'hunting', 'horseback riding', 'equestrian', 'rodeo', 'skateboarding',
  'snowshoeing', 'triathlon', 'decathlon', 'pentathlon', 'curling',
  'bobsled', 'luge', 'skeleton', 'biathlon', 'cricket', 'darts',
]);

/** Map category slugs to their word sets */
// ── Expansion set (launch content wave) ─────────────────────────────────
// Same conventions as above: lowercase, singular (stemming handles plurals),
// intentionally generous. Flagged for SLP review like all bank content.

const BODY_PARTS = new Set([
  'head', 'hair', 'face', 'eye', 'eyebrow', 'eyelash', 'ear', 'nose', 'nostril',
  'mouth', 'lip', 'tooth', 'teeth', 'tongue', 'chin', 'cheek', 'jaw', 'forehead',
  'neck', 'throat', 'shoulder', 'arm', 'elbow', 'wrist', 'hand', 'palm', 'finger',
  'thumb', 'fingernail', 'nail', 'chest', 'back', 'spine', 'stomach', 'belly',
  'waist', 'hip', 'leg', 'thigh', 'knee', 'shin', 'calf', 'ankle', 'foot', 'feet',
  'toe', 'heel', 'skin', 'muscle', 'bone', 'heart', 'lung', 'brain', 'liver',
  'kidney', 'rib', 'skull', 'knuckle', 'armpit', 'scalp', 'vein', 'blood',
]);

const FURNITURE = new Set([
  'chair', 'table', 'sofa', 'couch', 'bed', 'desk', 'dresser', 'wardrobe',
  'closet', 'bookshelf', 'shelf', 'bookcase', 'cabinet', 'cupboard', 'stool',
  'bench', 'armchair', 'recliner', 'rocking chair', 'ottoman', 'futon',
  'nightstand', 'headboard', 'mattress', 'crib', 'bunk bed', 'coffee table',
  'end table', 'dining table', 'sideboard', 'buffet', 'hutch', 'vanity',
  'mirror', 'lamp', 'chandelier', 'rug', 'carpet', 'curtain', 'drape',
  'loveseat', 'sectional', 'filing cabinet', 'drawer', 'chest', 'trunk',
  'hammock', 'highchair', 'barstool', 'footstool',
]);

const DRINKS = new Set([
  'water', 'milk', 'juice', 'coffee', 'tea', 'soda', 'pop', 'cola', 'lemonade',
  'smoothie', 'milkshake', 'shake', 'cocoa', 'hot chocolate', 'cider', 'punch',
  'iced tea', 'espresso', 'latte', 'cappuccino', 'mocha', 'beer', 'wine',
  'champagne', 'whiskey', 'vodka', 'rum', 'gin', 'cocktail', 'margarita',
  'orange juice', 'apple juice', 'grape juice', 'cranberry juice', 'root beer',
  'ginger ale', 'sports drink', 'gatorade', 'kool aid', 'seltzer',
  'sparkling water', 'tonic', 'eggnog', 'kombucha', 'slushie',
]);

const INSTRUMENTS = new Set([
  'piano', 'guitar', 'drum', 'violin', 'flute', 'trumpet', 'trombone', 'tuba',
  'saxophone', 'sax', 'clarinet', 'oboe', 'bassoon', 'cello', 'bass', 'harp',
  'banjo', 'ukulele', 'mandolin', 'accordion', 'harmonica', 'organ', 'keyboard',
  'synthesizer', 'xylophone', 'marimba', 'tambourine', 'triangle', 'cymbal',
  'maracas', 'bongo', 'conga', 'bagpipe', 'fiddle', 'viola', 'piccolo',
  'recorder', 'french horn', 'horn', 'bell', 'chime', 'gong', 'kazoo',
  'castanets', 'cowbell', 'sitar', 'didgeridoo',
]);

const PLACES_IN_TOWN = new Set([
  'store', 'shop', 'school', 'church', 'library', 'hospital', 'clinic',
  'pharmacy', 'drugstore', 'bank', 'post office', 'restaurant', 'cafe',
  'diner', 'bakery', 'grocery store', 'supermarket', 'market', 'mall',
  'park', 'playground', 'gym', 'pool', 'museum', 'theater', 'cinema',
  'movie theater', 'gas station', 'garage', 'barbershop', 'salon',
  'fire station', 'police station', 'courthouse', 'city hall', 'hotel',
  'motel', 'airport', 'train station', 'bus stop', 'zoo', 'stadium',
  'arena', 'bar', 'pub', 'laundromat', 'dentist', 'office', 'factory',
  'warehouse', 'farm', 'beach', 'pier', 'harbor', 'bridge',
]);

const WEATHER = new Set([
  'rain', 'snow', 'sun', 'sunshine', 'wind', 'cloud', 'storm', 'thunder',
  'lightning', 'hail', 'sleet', 'fog', 'mist', 'drizzle', 'shower',
  'hurricane', 'tornado', 'blizzard', 'frost', 'ice', 'heat', 'cold',
  'humidity', 'breeze', 'gust', 'rainbow', 'dew', 'flood', 'drought',
  'heatwave', 'cold front', 'overcast', 'sunny', 'cloudy', 'rainy',
  'snowy', 'windy', 'stormy', 'foggy', 'freezing', 'hot', 'warm', 'cool',
  'chilly', 'muggy', 'thunderstorm', 'downpour', 'flurry',
]);

const COUNTRIES = new Set([
  'america', 'united states', 'usa', 'canada', 'mexico', 'brazil', 'argentina',
  'chile', 'peru', 'colombia', 'cuba', 'jamaica', 'england', 'britain',
  'united kingdom', 'ireland', 'scotland', 'wales', 'france', 'spain',
  'portugal', 'italy', 'germany', 'austria', 'switzerland', 'netherlands',
  'holland', 'belgium', 'denmark', 'norway', 'sweden', 'finland', 'iceland',
  'poland', 'russia', 'ukraine', 'greece', 'turkey', 'egypt', 'morocco',
  'nigeria', 'kenya', 'ethiopia', 'south africa', 'ghana', 'israel',
  'saudi arabia', 'iran', 'iraq', 'india', 'pakistan', 'china', 'japan',
  'korea', 'south korea', 'north korea', 'vietnam', 'thailand', 'philippines',
  'indonesia', 'malaysia', 'singapore', 'australia', 'new zealand', 'fiji',
  'hungary', 'romania', 'czech republic', 'croatia', 'cambodia', 'laos',
]);

const PLANTS = new Set([
  'rose', 'tulip', 'daisy', 'sunflower', 'lily', 'orchid', 'daffodil',
  'carnation', 'violet', 'pansy', 'petunia', 'marigold', 'iris', 'poppy',
  'lavender', 'jasmine', 'hibiscus', 'peony', 'chrysanthemum', 'mum',
  'dandelion', 'buttercup', 'bluebell', 'lilac', 'magnolia', 'azalea',
  'oak', 'maple', 'pine', 'birch', 'willow', 'elm', 'cedar', 'spruce',
  'palm', 'fir', 'redwood', 'sequoia', 'aspen', 'poplar', 'sycamore',
  'chestnut', 'walnut', 'apple tree', 'cherry tree', 'dogwood', 'evergreen',
  'fern', 'moss', 'ivy', 'cactus', 'bamboo', 'grass', 'shrub', 'bush',
  'vine', 'clover', 'holly', 'mistletoe', 'aloe', 'succulent',
]);

const HOBBIES = new Set([
  'reading', 'writing', 'painting', 'drawing', 'cooking', 'baking',
  'gardening', 'fishing', 'hunting', 'hiking', 'camping', 'knitting',
  'sewing', 'crocheting', 'quilting', 'woodworking', 'photography',
  'dancing', 'singing', 'traveling', 'birdwatching', 'collecting',
  'chess', 'checkers', 'puzzles', 'crossword', 'sudoku', 'cards',
  'poker', 'bridge', 'bingo', 'bowling', 'golfing', 'golf', 'swimming',
  'biking', 'cycling', 'running', 'jogging', 'walking', 'yoga',
  'exercising', 'scrapbooking', 'pottery', 'ceramics', 'crafts',
  'gaming', 'video games', 'movies', 'music', 'piano', 'guitar',
  'stamp collecting', 'coin collecting', 'antiquing', 'volunteering',
]);

const CATEGORY_WORD_MAP: Record<string, Set<string>> = {
  animals: ANIMALS,
  foods: FOODS,
  colors: COLORS,
  clothes: CLOTHES,
  kitchen: KITCHEN,
  tools: TOOLS,
  vehicles: VEHICLES,
  professions: JOBS,
  emotions: EMOTIONS,
  sports: SPORTS,
  body: BODY_PARTS,
  furniture: FURNITURE,
  drinks: DRINKS,
  instruments: INSTRUMENTS,
  places: PLACES_IN_TOWN,
  weather: WEATHER,
  countries: COUNTRIES,
  plants: PLANTS,
  hobbies: HOBBIES,
};

// Common filler / stop words to silently ignore (not show as rejected)
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'am',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'i', 'me', 'my', 'we', 'us', 'you', 'your', 'he', 'she', 'it', 'they',
  'them', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up',
  'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'um', 'uh', 'hmm', 'oh', 'ah', 'like', 'just', 'so', 'well', 'ok',
  'okay', 'yeah', 'yes', 'no', 'not', 'also', 'too', 'very', 'really',
  'then', 'than', 'there', 'here', 'now', 'how', 'all', 'each', 'every',
  'some', 'any', 'many', 'much', 'more', 'most', 'other', 'another',
  'let', 'see', 'think', 'know', 'say', 'go', 'get', 'make', 'take',
]);

/**
 * Normalize a word for matching: lowercase, strip plurals/suffixes
 */
function normalizeWord(word: string): string[] {
  const w = word.toLowerCase().trim().replace(/[^a-z'-]/g, '');
  if (!w || w.length < 2) return [];
  
  // Generate candidate forms for fuzzy matching
  const candidates = [w];
  
  // Strip common suffixes
  if (w.endsWith('ies')) candidates.push(w.slice(0, -3) + 'y'); // puppies → puppy
  if (w.endsWith('es')) candidates.push(w.slice(0, -2));        // foxes → fox
  if (w.endsWith('s') && !w.endsWith('ss')) candidates.push(w.slice(0, -1)); // dogs → dog
  if (w.endsWith('ing')) {
    candidates.push(w.slice(0, -3));     // running → runn → run
    candidates.push(w.slice(0, -3) + 'e'); // skating → skate
    // Handle doubled consonant: running → run
    const stem = w.slice(0, -3);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      candidates.push(stem.slice(0, -1));
    }
  }
  if (w.endsWith('er')) candidates.push(w.slice(0, -2)); // swimmer → swimm
  if (w.endsWith('ly')) candidates.push(w.slice(0, -2));
  if (w.endsWith('ful')) candidates.push(w.slice(0, -3));
  
  return candidates.filter(c => c.length >= 2);
}

export type WordValidation = 'valid' | 'invalid' | 'filler';

/**
 * Check if a word belongs to the given category.
 * Returns 'valid', 'invalid', or 'filler' (stop words to silently ignore).
 */
export function validateCategoryWord(word: string, categorySlug: string): WordValidation {
  const clean = word.toLowerCase().trim().replace(/[^a-z'-\s]/g, '');
  
  // Check filler first
  if (FILLER_WORDS.has(clean)) return 'filler';
  if (clean.length < 2) return 'filler';
  
  const wordSet = CATEGORY_WORD_MAP[categorySlug];
  if (!wordSet) return 'valid'; // Unknown category — accept all (safe fallback)
  
  // Direct match
  if (wordSet.has(clean)) return 'valid';
  
  // Try normalized/stemmed forms
  const candidates = normalizeWord(clean);
  for (const candidate of candidates) {
    if (wordSet.has(candidate)) return 'valid';
  }
  
  // Check if the word is a truncated form of a valid word (speech mishearing)
  // e.g., "eleph" for "elephant", "hippo" for "hippopotamus"
  // Require the input to cover at least 60% of the valid word to avoid false matches
  // like "blue" → "bluejay" or "car" → "cardinal"
  for (const valid of wordSet) {
    if (valid.includes(' ')) continue; // Skip compound words for prefix matching
    if (valid.startsWith(clean) && clean.length >= 4 && clean.length / valid.length >= 0.6) return 'valid';
    if (clean.startsWith(valid) && valid.length >= 4 && valid.length / clean.length >= 0.6) return 'valid';
  }
  
  return 'invalid';
}

/**
 * Check if a multi-word phrase is an exact match in the category word list.
 * Used for bigram matching in speech — stricter than validateCategoryWord
 * to avoid false compound matches like "dog cat" → valid.
 */
export function isExactCategoryMatch(phrase: string, categorySlug: string): boolean {
  const clean = phrase.toLowerCase().trim();
  const wordSet = CATEGORY_WORD_MAP[categorySlug];
  if (!wordSet) return false;
  return wordSet.has(clean);
}

/**
 * Get count of valid words from a list
 */
export function countValidWords(words: string[], categorySlug: string): number {
  const seen = new Set<string>();
  let count = 0;
  for (const w of words) {
    const normalized = w.toLowerCase().trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (validateCategoryWord(w, categorySlug) === 'valid') count++;
  }
  return count;
}
