/**
 * CueBank - Structured cue variant registry
 * 
 * Provides 4 cue types per word:
 *   phonemic     → initial sound / syllable count
 *   semantic     → meaning / function / category description
 *   sentence_completion → carrier phrase with blank
 *   repetition   → direct model ("Say: ___")
 * 
 * Keyed by lowercase target word for O(1) lookup.
 * Designed to plug into the existing cue personalization engine
 * (cueSelector.ts / cueGenerator.ts / useSessionAdaptation.ts).
 */

// ─── Types ───────────────────────────────────────────────────

export type CueBankType =
  | 'phonemic'
  | 'semantic'
  | 'sentence_completion'
  | 'repetition';

export interface CueVariant {
  type: CueBankType;
  text: string;
  /** Optional difficulty tier (1 = easiest cue, 3 = hardest) */
  difficulty?: number;
  /** Optional clinical tags for filtering */
  tags?: string[];
}

// ─── Registry ────────────────────────────────────────────────

export const cueBank: Record<string, CueVariant[]> = {
  // ── Core vocabulary (Tier 1) ──────────────────────────────
  house: [
    { type: 'phonemic', text: 'It starts with /h/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'People live in it. It has rooms and a roof.', difficulty: 1 },
    { type: 'sentence_completion', text: 'We live in a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: house.', difficulty: 1 },
  ],
  cup: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'You drink from it. It holds liquids.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She drank coffee from a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: cup.', difficulty: 1 },
  ],
  dog: [
    { type: 'phonemic', text: 'It starts with /d/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A common pet that barks and wags its tail.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ fetched the ball.', difficulty: 1 },
    { type: 'repetition', text: 'Say: dog.', difficulty: 1 },
  ],
  apple: [
    { type: 'phonemic', text: 'It starts with /æ/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A round fruit that can be red, green, or yellow.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She bit into a juicy ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: apple.', difficulty: 1 },
  ],
  chair: [
    { type: 'phonemic', text: 'It starts with /tʃ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A piece of furniture you sit on. It has legs and a back.', difficulty: 1 },
    { type: 'sentence_completion', text: 'Please sit down in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: chair.', difficulty: 1 },
  ],
  phone: [
    { type: 'phonemic', text: 'It starts with /f/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'An electronic device used to make calls and send messages.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He picked up the ___ and called his friend.', difficulty: 1 },
    { type: 'repetition', text: 'Say: phone.', difficulty: 1 },
  ],
  bird: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'An animal with feathers and wings that can fly.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ sang in the tree.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bird.', difficulty: 1 },
  ],
  bread: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A baked food made from flour. You make sandwiches with it.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He spread butter on the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bread.', difficulty: 1 },
  ],
  car: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A vehicle with four wheels that you drive on roads.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She drove her ___ to work.', difficulty: 1 },
    { type: 'repetition', text: 'Say: car.', difficulty: 1 },
  ],
  hand: [
    { type: 'phonemic', text: 'It starts with /h/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A body part at the end of your arm with five fingers.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He raised his ___ to wave.', difficulty: 1 },
    { type: 'repetition', text: 'Say: hand.', difficulty: 1 },
  ],
  eye: [
    { type: 'phonemic', text: 'It starts with /aɪ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A body part you use to see. You have two of them.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She closed her ___ and went to sleep.', difficulty: 1 },
    { type: 'repetition', text: 'Say: eye.', difficulty: 1 },
  ],
  cat: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A small pet that purrs and chases mice.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ curled up on the couch.', difficulty: 1 },
    { type: 'repetition', text: 'Say: cat.', difficulty: 1 },
  ],
  bike: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A two-wheeled vehicle you pedal to ride.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He rode his ___ to the park.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bike.', difficulty: 1 },
  ],
  ball: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A round object used in many sports and games.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The child threw the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: ball.', difficulty: 1 },
  ],
  book: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'It has pages with words. You read it.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She read a ___ before bed.', difficulty: 1 },
    { type: 'repetition', text: 'Say: book.', difficulty: 1 },
  ],
  tree: [
    { type: 'phonemic', text: 'It starts with /t/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A tall plant with a trunk, branches, and leaves.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The birds nested in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: tree.', difficulty: 1 },
  ],
  shoe: [
    { type: 'phonemic', text: 'It starts with /ʃ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'You wear it on your foot to protect it.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She tied her ___ before the race.', difficulty: 1 },
    { type: 'repetition', text: 'Say: shoe.', difficulty: 1 },
  ],
  door: [
    { type: 'phonemic', text: 'It starts with /d/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'You open and close it to enter a room.', difficulty: 1 },
    { type: 'sentence_completion', text: 'Please close the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: door.', difficulty: 1 },
  ],
  flower: [
    { type: 'phonemic', text: 'It starts with /f/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A colorful plant that blooms in a garden. It smells nice.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She picked a ___ from the garden.', difficulty: 1 },
    { type: 'repetition', text: 'Say: flower.', difficulty: 1 },
  ],
  spoon: [
    { type: 'phonemic', text: 'It starts with /sp/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A utensil used to eat soup or cereal.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He stirred the soup with a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: spoon.', difficulty: 1 },
  ],
  key: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A small metal object used to open a lock.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She turned the ___ in the lock.', difficulty: 1 },
    { type: 'repetition', text: 'Say: key.', difficulty: 1 },
  ],
  watch: [
    { type: 'phonemic', text: 'It starts with /w/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'You wear it on your wrist to tell the time.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He checked his ___ to see the time.', difficulty: 1 },
    { type: 'repetition', text: 'Say: watch.', difficulty: 1 },
  ],
  nose: [
    { type: 'phonemic', text: 'It starts with /n/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A body part on your face used for smelling and breathing.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She wrinkled her ___ at the smell.', difficulty: 1 },
    { type: 'repetition', text: 'Say: nose.', difficulty: 1 },
  ],
  cake: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A sweet baked dessert, often with frosting. You eat it at birthdays.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They blew out the candles on the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: cake.', difficulty: 1 },
  ],
  star: [
    { type: 'phonemic', text: 'It starts with /st/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A bright point of light in the night sky.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They looked up at the bright ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: star.', difficulty: 1 },
  ],
  rain: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'Water that falls from clouds in the sky.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ made the streets wet.', difficulty: 1 },
    { type: 'repetition', text: 'Say: rain.', difficulty: 1 },
  ],
  lamp: [
    { type: 'phonemic', text: 'It starts with /l/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A device that gives light. You turn it on in a dark room.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She turned on the ___ to read.', difficulty: 1 },
    { type: 'repetition', text: 'Say: lamp.', difficulty: 1 },
  ],
  ship: [
    { type: 'phonemic', text: 'It starts with /ʃ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A large vessel that sails on the ocean.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ sailed across the sea.', difficulty: 1 },
    { type: 'repetition', text: 'Say: ship.', difficulty: 1 },
  ],

  // ── Phoneme-targeted vocabulary ───────────────────────────
  thumb: [
    { type: 'phonemic', text: 'It starts with /θ/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'The short, thick finger on your hand.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She gave a ___ up to show she liked it.', difficulty: 1 },
    { type: 'repetition', text: 'Say: thumb.', difficulty: 1 },
  ],
  cheese: [
    { type: 'phonemic', text: 'It starts with /tʃ/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A dairy food often put on sandwiches or pizza.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He added ___ to his sandwich.', difficulty: 1 },
    { type: 'repetition', text: 'Say: cheese.', difficulty: 1 },
  ],
  jar: [
    { type: 'phonemic', text: 'It starts with /dʒ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A glass container with a lid, used to store food.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She opened the ___ of jam.', difficulty: 1 },
    { type: 'repetition', text: 'Say: jar.', difficulty: 1 },
  ],
  fish: [
    { type: 'phonemic', text: 'It starts with /f/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'An animal that lives in water and has fins and scales.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ swam in the pond.', difficulty: 1 },
    { type: 'repetition', text: 'Say: fish.', difficulty: 1 },
  ],
  moon: [
    { type: 'phonemic', text: 'It starts with /m/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A round object in the night sky that reflects sunlight.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ was full and bright last night.', difficulty: 1 },
    { type: 'repetition', text: 'Say: moon.', difficulty: 1 },
  ],
  nail: [
    { type: 'phonemic', text: 'It starts with /n/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A thin pointed metal piece you hammer into wood.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He hammered the ___ into the wall.', difficulty: 1 },
    { type: 'repetition', text: 'Say: nail.', difficulty: 1 },
  ],
  leaf: [
    { type: 'phonemic', text: 'It starts with /l/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'The flat green part of a plant or tree.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A ___ fell from the tree.', difficulty: 1 },
    { type: 'repetition', text: 'Say: leaf.', difficulty: 1 },
  ],
  ring: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A circular piece of jewelry worn on the finger.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He put the ___ on her finger.', difficulty: 1 },
    { type: 'repetition', text: 'Say: ring.', difficulty: 1 },
  ],

  // ── Minimal pair words ────────────────────────────────────
  hat: [
    { type: 'phonemic', text: 'It starts with /h/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'You wear it on your head to protect from sun or cold.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She put on her ___ before going outside.', difficulty: 1 },
    { type: 'repetition', text: 'Say: hat.', difficulty: 1 },
  ],
  chip: [
    { type: 'phonemic', text: 'It starts with /tʃ/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A thin, crispy snack made from potatoes.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He ate a ___ from the bag.', difficulty: 1 },
    { type: 'repetition', text: 'Say: chip.', difficulty: 1 },
  ],
  fan: [
    { type: 'phonemic', text: 'It starts with /f/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A device that blows air to keep you cool.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She turned on the ___ because it was hot.', difficulty: 1 },
    { type: 'repetition', text: 'Say: fan.', difficulty: 1 },
  ],
  van: [
    { type: 'phonemic', text: 'It starts with /v/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A large vehicle for carrying people or things.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They loaded the boxes into the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: van.', difficulty: 1 },
  ],
  bed: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A piece of furniture you sleep on at night.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The child climbed into ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bed.', difficulty: 1 },
  ],
  red: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A color like fire or strawberries.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The stop sign is ___.', difficulty: 2 },
    { type: 'repetition', text: 'Say: red.', difficulty: 1 },
  ],
  pen: [
    { type: 'phonemic', text: 'It starts with /p/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A tool used for writing with ink.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She signed her name with a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pen.', difficulty: 1 },
  ],
  hen: [
    { type: 'phonemic', text: 'It starts with /h/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A female chicken that lays eggs.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ sat on her eggs in the coop.', difficulty: 2 },
    { type: 'repetition', text: 'Say: hen.', difficulty: 1 },
  ],
  goat: [
    { type: 'phonemic', text: 'It starts with /g/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A farm animal with horns and a beard.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ climbed up the rocky hill.', difficulty: 2 },
    { type: 'repetition', text: 'Say: goat.', difficulty: 1 },
  ],
  coat: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'An outer garment you wear when it is cold.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He put on his ___ before going out in the cold.', difficulty: 1 },
    { type: 'repetition', text: 'Say: coat.', difficulty: 1 },
  ],

  // ── /v/ sound ─────────────────────────────────────────────
  vase: [
    { type: 'phonemic', text: 'It starts with /v/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A container used to hold flowers, often made of glass.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She put the flowers in a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: vase.', difficulty: 1 },
  ],
  vest: [
    { type: 'phonemic', text: 'It starts with /v/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A sleeveless garment worn over a shirt.', difficulty: 2 },
    { type: 'sentence_completion', text: 'He wore a ___ under his jacket.', difficulty: 2 },
    { type: 'repetition', text: 'Say: vest.', difficulty: 1 },
  ],

  // ── /θ/ sound (voiceless "th") ────────────────────────────
  three: [
    { type: 'phonemic', text: 'It starts with /θ/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'The number after two.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She held up ___ fingers.', difficulty: 1 },
    { type: 'repetition', text: 'Say: three.', difficulty: 1 },
  ],
  tooth: [
    { type: 'phonemic', text: 'It starts with /t/ and ends with /θ/. One syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A hard white structure in your mouth used for chewing.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The child lost a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: tooth.', difficulty: 1 },
  ],

  // ── /dʒ/ sound ────────────────────────────────────────────
  jug: [
    { type: 'phonemic', text: 'It starts with /dʒ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A large container with a handle, used for pouring drinks.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She poured water from the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: jug.', difficulty: 1 },
  ],
  jet: [
    { type: 'phonemic', text: 'It starts with /dʒ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A very fast airplane powered by engines.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ flew high above the clouds.', difficulty: 1 },
    { type: 'repetition', text: 'Say: jet.', difficulty: 1 },
  ],

  // ── /ð/ voiced "th" (medial) ──────────────────────────────
  feather: [
    { type: 'phonemic', text: 'It starts with /f/ and has two syllables.', difficulty: 2 },
    { type: 'semantic', text: 'A light, soft covering that grows on birds.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ floated down from the sky.', difficulty: 2 },
    { type: 'repetition', text: 'Say: feather.', difficulty: 1 },
  ],
  mother: [
    { type: 'phonemic', text: 'It starts with /m/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A female parent. She takes care of her children.', difficulty: 1 },
    { type: 'sentence_completion', text: 'His ___ made dinner for the family.', difficulty: 1 },
    { type: 'repetition', text: 'Say: mother.', difficulty: 1 },
  ],
  weather: [
    { type: 'phonemic', text: 'It starts with /w/ and has two syllables.', difficulty: 2 },
    { type: 'semantic', text: 'The state of the atmosphere — sunny, rainy, cloudy, etc.', difficulty: 2 },
    { type: 'sentence_completion', text: 'The ___ today is sunny and warm.', difficulty: 1 },
    { type: 'repetition', text: 'Say: weather.', difficulty: 1 },
  ],

  // ── Additional minimal pairs ──────────────────────────────
  pin: [
    { type: 'phonemic', text: 'It starts with /p/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A thin pointed piece of metal used to fasten things.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She used a ___ to hold the fabric together.', difficulty: 2 },
    { type: 'repetition', text: 'Say: pin.', difficulty: 1 },
  ],
  bin: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A container for storing or throwing away things.', difficulty: 1 },
    { type: 'sentence_completion', text: 'Throw the paper in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bin.', difficulty: 1 },
  ],
  cap: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A type of hat with a visor, often worn for sports.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He wore a baseball ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: cap.', difficulty: 1 },
  ],
  cab: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A car you hire for a ride, also called a taxi.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She hailed a ___ on the street.', difficulty: 2 },
    { type: 'repetition', text: 'Say: cab.', difficulty: 1 },
  ],
  teeth: [
    { type: 'phonemic', text: 'It starts with /t/ and ends with /θ/. One syllable.', difficulty: 2 },
    { type: 'semantic', text: 'The hard white structures in your mouth (plural).', difficulty: 1 },
    { type: 'sentence_completion', text: 'Brush your ___ twice a day.', difficulty: 1 },
    { type: 'repetition', text: 'Say: teeth.', difficulty: 1 },
  ],
  teethe: [
    { type: 'phonemic', text: 'It starts with /t/ and ends with /ð/. One syllable.', difficulty: 3 },
    { type: 'semantic', text: 'When a baby grows new teeth and chews on things.', difficulty: 2 },
    { type: 'sentence_completion', text: 'The baby started to ___ at six months.', difficulty: 3 },
    { type: 'repetition', text: 'Say: teethe.', difficulty: 2 },
  ],

  // ── Consonant cluster words ───────────────────────────────
  spider: [
    { type: 'phonemic', text: 'It starts with /sp/ and has two syllables.', difficulty: 2 },
    { type: 'semantic', text: 'A small creature with eight legs that spins webs.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ built a web in the corner.', difficulty: 1 },
    { type: 'repetition', text: 'Say: spider.', difficulty: 1 },
  ],
  stick: [
    { type: 'phonemic', text: 'It starts with /st/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A thin piece of wood from a tree or branch.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The dog carried a ___ in its mouth.', difficulty: 1 },
    { type: 'repetition', text: 'Say: stick.', difficulty: 1 },
  ],
  block: [
    { type: 'phonemic', text: 'It starts with /bl/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A solid piece of wood, plastic, or other material. Children build with them.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The child stacked one ___ on top of another.', difficulty: 1 },
    { type: 'repetition', text: 'Say: block.', difficulty: 1 },
  ],
  flag: [
    { type: 'phonemic', text: 'It starts with /fl/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A piece of fabric with colors or symbols that represents a country.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ waved in the wind.', difficulty: 1 },
    { type: 'repetition', text: 'Say: flag.', difficulty: 1 },
  ],

  // ── /j/ (y) and /ʒ/ (zh) phonemes ────────────────────────
  yellow: [
    { type: 'phonemic', text: 'It starts with /j/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A bright color like the sun or a banana.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The sunflower was bright ___.', difficulty: 2 },
    { type: 'repetition', text: 'Say: yellow.', difficulty: 1 },
  ],
  treasure: [
    { type: 'phonemic', text: 'It starts with /t/ and has two syllables.', difficulty: 2 },
    { type: 'semantic', text: 'Valuable things like gold, jewels, and riches.', difficulty: 2 },
    { type: 'sentence_completion', text: 'The pirate found buried ___.', difficulty: 2 },
    { type: 'repetition', text: 'Say: treasure.', difficulty: 1 },
  ],
  measure: [
    { type: 'phonemic', text: 'It starts with /m/ and has two syllables.', difficulty: 2 },
    { type: 'semantic', text: 'To find the size, length, or amount of something.', difficulty: 2 },
    { type: 'sentence_completion', text: 'Use a ruler to ___ the table.', difficulty: 2 },
    { type: 'repetition', text: 'Say: measure.', difficulty: 1 },
  ],
  yes: [
    { type: 'phonemic', text: 'It starts with /j/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A word that means you agree or approve.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She nodded and said ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: yes.', difficulty: 1 },
  ],
  yard: [
    { type: 'phonemic', text: 'It starts with /j/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'An area of grass around a house.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The children played in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: yard.', difficulty: 1 },
  ],
  yawn: [
    { type: 'phonemic', text: 'It starts with /j/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'Opening your mouth wide when you are tired or sleepy.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She let out a big ___ before bed.', difficulty: 2 },
    { type: 'repetition', text: 'Say: yawn.', difficulty: 1 },
  ],
  yell: [
    { type: 'phonemic', text: 'It starts with /j/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'To shout or cry out loudly.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He had to ___ so they could hear him.', difficulty: 2 },
    { type: 'repetition', text: 'Say: yell.', difficulty: 1 },
  ],

  // ── Phoneme gap fills: /g/ ────────────────────────────────
  gate: [
    { type: 'phonemic', text: 'It starts with /g/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A door-like barrier in a fence or wall.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She opened the ___ and walked into the garden.', difficulty: 1 },
    { type: 'repetition', text: 'Say: gate.', difficulty: 1 },
  ],
  grape: [
    { type: 'phonemic', text: 'It starts with /gr/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A small round fruit that grows in bunches. Used to make wine.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She plucked a ___ from the vine.', difficulty: 2 },
    { type: 'repetition', text: 'Say: grape.', difficulty: 1 },
  ],
  glove: [
    { type: 'phonemic', text: 'It starts with /gl/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A covering for the hand with separate finger sections.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He put on a ___ to keep his hand warm.', difficulty: 1 },
    { type: 'repetition', text: 'Say: glove.', difficulty: 1 },
  ],

  // ── /z/ phoneme ───────────────────────────────────────────
  zoo: [
    { type: 'phonemic', text: 'It starts with /z/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A place where wild animals are kept for people to see.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The family visited the ___ on Saturday.', difficulty: 1 },
    { type: 'repetition', text: 'Say: zoo.', difficulty: 1 },
  ],
  zip: [
    { type: 'phonemic', text: 'It starts with /z/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A fastener with interlocking teeth on jackets and bags.', difficulty: 2 },
    { type: 'sentence_completion', text: 'She pulled up the ___ on her jacket.', difficulty: 1 },
    { type: 'repetition', text: 'Say: zip.', difficulty: 1 },
  ],

  // ── /l/ phoneme ───────────────────────────────────────────
  lion: [
    { type: 'phonemic', text: 'It starts with /l/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A large wild cat called the king of the jungle. It has a mane.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ roared in the savanna.', difficulty: 1 },
    { type: 'repetition', text: 'Say: lion.', difficulty: 1 },
  ],
  lemon: [
    { type: 'phonemic', text: 'It starts with /l/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A sour yellow citrus fruit.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She squeezed ___ juice into her water.', difficulty: 1 },
    { type: 'repetition', text: 'Say: lemon.', difficulty: 1 },
  ],

  // ── /d/ phoneme ───────────────────────────────────────────
  duck: [
    { type: 'phonemic', text: 'It starts with /d/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A bird that swims on water and says "quack."', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ swam across the pond.', difficulty: 1 },
    { type: 'repetition', text: 'Say: duck.', difficulty: 1 },
  ],
  drum: [
    { type: 'phonemic', text: 'It starts with /dr/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A musical instrument you hit with sticks.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He beat the ___ in the band.', difficulty: 1 },
    { type: 'repetition', text: 'Say: drum.', difficulty: 1 },
  ],

  // ── /r/ phoneme ───────────────────────────────────────────
  rope: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A thick cord or string used for tying or pulling.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She tied the boat to the dock with a ___.', difficulty: 2 },
    { type: 'repetition', text: 'Say: rope.', difficulty: 1 },
  ],
  rose: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A beautiful flower, often red, with thorns on its stem.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He gave her a red ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: rose.', difficulty: 1 },
  ],

  // ── /n/ phoneme ───────────────────────────────────────────
  net: [
    { type: 'phonemic', text: 'It starts with /n/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A mesh material used to catch fish or hit balls over.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ball went over the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: net.', difficulty: 1 },
  ],
  nut: [
    { type: 'phonemic', text: 'It starts with /n/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A hard-shelled seed or fruit you can eat as a snack.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The squirrel ate a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: nut.', difficulty: 1 },
  ],

  // ── /w/ phoneme ───────────────────────────────────────────
  web: [
    { type: 'phonemic', text: 'It starts with /w/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A silky net that a spider spins.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The spider sat in the middle of its ___.', difficulty: 2 },
    { type: 'repetition', text: 'Say: web.', difficulty: 1 },
  ],

  // ── /p/ phoneme ───────────────────────────────────────────
  pie: [
    { type: 'phonemic', text: 'It starts with /p/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A baked dish with a crust and filling, sweet or savory.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She baked an apple ___ for dessert.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pie.', difficulty: 1 },
  ],

  // ── Medial / Final position words ─────────────────────────
  wagon: [
    { type: 'phonemic', text: 'It starts with /w/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A four-wheeled cart you pull behind you.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The child pulled the red ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: wagon.', difficulty: 1 },
  ],
  tiger: [
    { type: 'phonemic', text: 'It starts with /t/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A large wild cat with orange and black stripes.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ prowled through the jungle.', difficulty: 1 },
    { type: 'repetition', text: 'Say: tiger.', difficulty: 1 },
  ],
  bag: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A flexible container used to carry things.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She packed her lunch in a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bag.', difficulty: 1 },
  ],
  puzzle: [
    { type: 'phonemic', text: 'It starts with /p/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A game where you fit pieces together to make a picture.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She finished the jigsaw ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: puzzle.', difficulty: 1 },
  ],
  pillow: [
    { type: 'phonemic', text: 'It starts with /p/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A soft cushion you rest your head on when sleeping.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She laid her head on the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pillow.', difficulty: 1 },
  ],
  bell: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A hollow metal object that makes a ringing sound.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The school ___ rang at noon.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bell.', difficulty: 1 },
  ],
  carrot: [
    { type: 'phonemic', text: 'It starts with /k/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A long orange vegetable that grows underground.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The rabbit ate a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: carrot.', difficulty: 1 },
  ],
  mirror: [
    { type: 'phonemic', text: 'It starts with /m/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A glass surface that shows your reflection.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She looked at herself in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: mirror.', difficulty: 1 },
  ],
  ladder: [
    { type: 'phonemic', text: 'It starts with /l/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A structure with steps used for climbing up or down.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He climbed the ___ to the roof.', difficulty: 1 },
    { type: 'repetition', text: 'Say: ladder.', difficulty: 1 },
  ],
  banana: [
    { type: 'phonemic', text: 'It starts with /b/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A long curved yellow fruit you peel to eat.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The monkey ate a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: banana.', difficulty: 1 },
  ],
  candle: [
    { type: 'phonemic', text: 'It starts with /k/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A wax stick with a wick that you light for flame.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She lit the ___ on the table.', difficulty: 1 },
    { type: 'repetition', text: 'Say: candle.', difficulty: 1 },
  ],
  puppy: [
    { type: 'phonemic', text: 'It starts with /p/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A young dog. It is small and playful.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ wagged its little tail.', difficulty: 1 },
    { type: 'repetition', text: 'Say: puppy.', difficulty: 1 },
  ],
  pig: [
    { type: 'phonemic', text: 'It starts with /p/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A farm animal with a curly tail and a snout.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ rolled in the mud.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pig.', difficulty: 1 },
  ],
  frog: [
    { type: 'phonemic', text: 'It starts with /fr/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A small green animal that hops and lives near water.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ jumped into the pond.', difficulty: 1 },
    { type: 'repetition', text: 'Say: frog.', difficulty: 1 },
  ],
  towel: [
    { type: 'phonemic', text: 'It starts with /t/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A piece of fabric used to dry yourself after a bath.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She dried her hands with a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: towel.', difficulty: 1 },
  ],

  // ── Batch 3: Medial position gap fills ────────────────────
  finger: [
    { type: 'phonemic', text: 'It starts with /f/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A part of your hand. You have five on each hand.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She pointed her ___ at the map.', difficulty: 1 },
    { type: 'repetition', text: 'Say: finger.', difficulty: 1 },
  ],
  rabbit: [
    { type: 'phonemic', text: 'It starts with /r/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A small furry animal with long ears that hops.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ hopped across the garden.', difficulty: 1 },
    { type: 'repetition', text: 'Say: rabbit.', difficulty: 1 },
  ],
  oven: [
    { type: 'phonemic', text: 'It starts with a vowel /ʌ/ and has two syllables.', difficulty: 2 },
    { type: 'semantic', text: 'A kitchen appliance used for baking and roasting food.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She baked the cake in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: oven.', difficulty: 1 },
  ],
  basket: [
    { type: 'phonemic', text: 'It starts with /b/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A woven container used to carry or store things.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She put the fruit in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: basket.', difficulty: 1 },
  ],
  coffee: [
    { type: 'phonemic', text: 'It starts with /k/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A hot brown drink made from roasted beans.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He drank a cup of ___ every morning.', difficulty: 1 },
    { type: 'repetition', text: 'Say: coffee.', difficulty: 1 },
  ],
  kitchen: [
    { type: 'phonemic', text: 'It starts with /k/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'The room in a house where you cook food.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She prepared dinner in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: kitchen.', difficulty: 1 },
  ],
  bridge: [
    { type: 'phonemic', text: 'It starts with /br/ and has one syllable.', difficulty: 2 },
    { type: 'semantic', text: 'A structure built over a river or road to cross it.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They walked across the ___ over the river.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bridge.', difficulty: 1 },
  ],
  button: [
    { type: 'phonemic', text: 'It starts with /b/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A small round fastener on clothing, or something you press.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She sewed the ___ back onto the shirt.', difficulty: 2 },
    { type: 'repetition', text: 'Say: button.', difficulty: 1 },
  ],
  pigeon: [
    { type: 'phonemic', text: 'It starts with /p/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A common grey bird often seen in cities.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A ___ landed on the park bench.', difficulty: 2 },
    { type: 'repetition', text: 'Say: pigeon.', difficulty: 1 },
  ],
  monkey: [
    { type: 'phonemic', text: 'It starts with /m/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'An animal that climbs trees and eats bananas.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ swung from branch to branch.', difficulty: 1 },
    { type: 'repetition', text: 'Say: monkey.', difficulty: 1 },
  ],
  garage: [
    { type: 'phonemic', text: 'It starts with /g/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A building or part of a house where you park a car.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He parked the car in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: garage.', difficulty: 1 },
  ],
  birthday: [
    { type: 'phonemic', text: 'It starts with /b/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'The day each year that celebrates when you were born.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They sang "Happy ___" and blew out the candles.', difficulty: 1 },
    { type: 'repetition', text: 'Say: birthday.', difficulty: 1 },
  ],
  harmonica: [
    { type: 'phonemic', text: 'It starts with /h/ and has four syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A small musical instrument you blow into. You hold it with both hands.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He played the blues on his ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: harmonica.', difficulty: 1 },
  ],
  pretzel: [
    { type: 'phonemic', text: 'It starts with /p/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A twisted baked snack, often salted.', difficulty: 1 },
    { type: 'sentence_completion', text: 'At the ballpark she ate a soft ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pretzel.', difficulty: 1 },
  ],
  wreath: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A round decoration of leaves or flowers, often hung on a door.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They hung a holiday ___ on the front door.', difficulty: 1 },
    { type: 'repetition', text: 'Say: wreath.', difficulty: 1 },
  ],
  asparagus: [
    { type: 'phonemic', text: 'It starts with /ə/ and has four syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A long green vegetable with thin spears.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She grilled some ___ for dinner.', difficulty: 1 },
    { type: 'repetition', text: 'Say: asparagus.', difficulty: 1 },
  ],
  accordion: [
    { type: 'phonemic', text: 'It starts with /ə/ and has four syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A musical instrument you squeeze in and out to play.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He squeezed the ___ and played a tune.', difficulty: 1 },
    { type: 'repetition', text: 'Say: accordion.', difficulty: 1 },
  ],
  stethoscope: [
    { type: 'phonemic', text: 'It starts with /s/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A medical tool doctors use to listen to your heart and lungs.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The doctor placed the ___ on her chest.', difficulty: 1 },
    { type: 'repetition', text: 'Say: stethoscope.', difficulty: 1 },
  ],
  thimble: [
    { type: 'phonemic', text: 'It starts with /θ/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A small cap that protects your finger when sewing.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She wore a ___ to push the needle through.', difficulty: 1 },
    { type: 'repetition', text: 'Say: thimble.', difficulty: 1 },
  ],
  anvil: [
    { type: 'phonemic', text: 'It starts with /æ/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A heavy iron block a blacksmith hammers metal on.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The blacksmith shaped the horseshoe on the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: anvil.', difficulty: 1 },
  ],
  hammock: [
    { type: 'phonemic', text: 'It starts with /h/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A hanging bed of fabric or net, used outside for resting.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He napped in the ___ between two trees.', difficulty: 1 },
    { type: 'repetition', text: 'Say: hammock.', difficulty: 1 },
  ],
  microscope: [
    { type: 'phonemic', text: 'It starts with /m/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A science tool that lets you see tiny things up close.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She looked at the cells under a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: microscope.', difficulty: 1 },
  ],
  pyramid: [
    { type: 'phonemic', text: 'It starts with /p/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'An ancient stone monument with four triangular sides.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They visited the great ___ in Egypt.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pyramid.', difficulty: 1 },
  ],
  telescope: [
    { type: 'phonemic', text: 'It starts with /t/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A long tube you look through to see things far away, like stars.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He watched the moon through a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: telescope.', difficulty: 1 },
  ],
  parachute: [
    { type: 'phonemic', text: 'It starts with /p/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A large cloth that opens in the air to slow your fall.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She jumped from the plane and opened her ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: parachute.', difficulty: 1 },
  ],
  octopus: [
    { type: 'phonemic', text: 'It starts with /ɒ/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A sea creature with eight long arms.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ has eight arms and lives in the ocean.', difficulty: 1 },
    { type: 'repetition', text: 'Say: octopus.', difficulty: 1 },
  ],
  pineapple: [
    { type: 'phonemic', text: 'It starts with /p/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A tropical fruit with spiky skin and sweet yellow inside.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She put ___ slices on her pizza.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pineapple.', difficulty: 1 },
  ],
  helicopter: [
    { type: 'phonemic', text: 'It starts with /h/ and has four syllables.', difficulty: 1 },
    { type: 'semantic', text: 'An aircraft with spinning blades on top that can hover.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ landed on the rooftop.', difficulty: 1 },
    { type: 'repetition', text: 'Say: helicopter.', difficulty: 1 },
  ],
  kangaroo: [
    { type: 'phonemic', text: 'It starts with /k/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A large hopping animal from Australia with a pouch.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ hopped across the field.', difficulty: 1 },
    { type: 'repetition', text: 'Say: kangaroo.', difficulty: 1 },
  ],
  alligator: [
    { type: 'phonemic', text: 'It starts with /æ/ and has four syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A large reptile with sharp teeth that lives in swamps.', difficulty: 1 },
    { type: 'sentence_completion', text: 'An ___ swam slowly through the swamp.', difficulty: 1 },
    { type: 'repetition', text: 'Say: alligator.', difficulty: 1 },
  ],
  dinosaur: [
    { type: 'phonemic', text: 'It starts with /d/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'An extinct giant reptile that lived long ago.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The museum had a huge ___ skeleton.', difficulty: 1 },
    { type: 'repetition', text: 'Say: dinosaur.', difficulty: 1 },
  ],
  elephant: [
    { type: 'phonemic', text: 'It starts with /ɛ/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A very large gray animal with a long trunk and big ears.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ sprayed water with its trunk.', difficulty: 1 },
    { type: 'repetition', text: 'Say: elephant.', difficulty: 1 },
  ],
  butterfly: [
    { type: 'phonemic', text: 'It starts with /b/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A colorful insect with large wings.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A ___ landed on the flower.', difficulty: 1 },
    { type: 'repetition', text: 'Say: butterfly.', difficulty: 1 },
  ],
  umbrella: [
    { type: 'phonemic', text: 'It starts with /ʌ/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'You open it over your head to keep the rain off.', difficulty: 1 },
    { type: 'sentence_completion', text: 'It started to rain so she opened her ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: umbrella.', difficulty: 1 },
  ],
  envelope: [
    { type: 'phonemic', text: 'It starts with /ɛ/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A paper pouch you put a letter in before mailing.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He sealed the letter inside the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: envelope.', difficulty: 1 },
  ],
  calendar: [
    { type: 'phonemic', text: 'It starts with /k/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A chart that shows the days, weeks, and months of the year.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She marked the date on her ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: calendar.', difficulty: 1 },
  ],
  fireplace: [
    { type: 'phonemic', text: 'It starts with /f/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A built-in spot in a home where you can build a fire.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They warmed up by the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: fireplace.', difficulty: 1 },
  ],
  peacock: [
    { type: 'phonemic', text: 'It starts with /p/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A bird known for its huge fan of colorful tail feathers.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ spread its bright tail feathers.', difficulty: 1 },
    { type: 'repetition', text: 'Say: peacock.', difficulty: 1 },
  ],
  acorn: [
    { type: 'phonemic', text: 'It starts with /eɪ/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'The small nut that grows on an oak tree.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A squirrel buried an ___ in the yard.', difficulty: 1 },
    { type: 'repetition', text: 'Say: acorn.', difficulty: 1 },
  ],
  igloo: [
    { type: 'phonemic', text: 'It starts with /ɪ/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A round shelter built from blocks of snow.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They built an ___ out of snow blocks.', difficulty: 1 },
    { type: 'repetition', text: 'Say: igloo.', difficulty: 1 },
  ],
  broccoli: [
    { type: 'phonemic', text: 'It starts with /b/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A green vegetable that looks like a tiny tree.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She steamed some ___ for dinner.', difficulty: 1 },
    { type: 'repetition', text: 'Say: broccoli.', difficulty: 1 },
  ],
  xylophone: [
    { type: 'phonemic', text: 'It starts with /z/ and has three syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A musical instrument with wooden bars you hit with mallets.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The child played a tune on the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: xylophone.', difficulty: 1 },
  ],
  robe: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A long loose piece of clothing you wear at home, often after a bath.', difficulty: 1 },
    { type: 'sentence_completion', text: 'After her shower she put on a warm ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: robe.', difficulty: 1 },
  ],
  reef: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A ridge of coral or rock just under the sea surface.', difficulty: 1 },
    { type: 'sentence_completion', text: 'Colorful fish swam around the coral ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: reef.', difficulty: 1 },
  ],
  ramp: [
    { type: 'phonemic', text: 'It starts with /r/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A slanted surface that connects two different levels.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He pushed the wheelchair up the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: ramp.', difficulty: 1 },
  ],
  iron: [
    { type: 'phonemic', text: 'It starts with /aɪ/ and has two syllables.', difficulty: 1 },
    { type: 'semantic', text: 'A hot household appliance you use to press wrinkles out of clothes.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She pressed her shirt with the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: iron.', difficulty: 1 },
  ],
  clove: [
    { type: 'phonemic', text: 'It starts with /k/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A small dark spice that smells strong and sweet.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She added a ___ of garlic to the sauce.', difficulty: 1 },
    { type: 'repetition', text: 'Say: clove.', difficulty: 1 },
  ],
  mouth: [
    { type: 'phonemic', text: 'It starts with /m/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'The opening on your face you eat and speak with.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He opened his ___ to take a bite.', difficulty: 1 },
    { type: 'repetition', text: 'Say: mouth.', difficulty: 1 },
  ],
  mouse: [
    { type: 'phonemic', text: 'It starts with /m/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A small rodent with a long tail.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A tiny ___ ran across the floor.', difficulty: 1 },
    { type: 'repetition', text: 'Say: mouse.', difficulty: 1 },
  ],
  fork: [
    { type: 'phonemic', text: 'It starts with /f/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A utensil with prongs you use to pick up food.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She picked up her ___ to eat the salad.', difficulty: 1 },
    { type: 'repetition', text: 'Say: fork.', difficulty: 1 },
  ],
  pork: [
    { type: 'phonemic', text: 'It starts with /p/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'Meat that comes from a pig.', difficulty: 1 },
    { type: 'sentence_completion', text: 'They had roasted ___ for dinner.', difficulty: 1 },
    { type: 'repetition', text: 'Say: pork.', difficulty: 1 },
  ],
  sheep: [
    { type: 'phonemic', text: 'It starts with /ʃ/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A farm animal with a wool coat that says baa.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ grazed quietly on the hillside.', difficulty: 1 },
    { type: 'repetition', text: 'Say: sheep.', difficulty: 1 },
  ],
  ham: [
    { type: 'phonemic', text: 'It starts with /h/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A salty meat from a pig, often eaten in sandwiches.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He made a ___ and cheese sandwich.', difficulty: 1 },
    { type: 'repetition', text: 'Say: ham.', difficulty: 1 },
  ],
  lamb: [
    { type: 'phonemic', text: 'It starts with /l/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A baby sheep.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A little ___ followed its mother.', difficulty: 1 },
    { type: 'repetition', text: 'Say: lamb.', difficulty: 1 },
  ],
  tie: [
    { type: 'phonemic', text: 'It starts with /t/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A long strip of fabric men wear knotted around the neck of a shirt.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He straightened his ___ before the meeting.', difficulty: 1 },
    { type: 'repetition', text: 'Say: tie.', difficulty: 1 },
  ],
  sun: [
    { type: 'phonemic', text: 'It starts with /s/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'The bright star that lights up the sky during the day.', difficulty: 1 },
    { type: 'sentence_completion', text: 'The ___ rose over the mountains.', difficulty: 1 },
    { type: 'repetition', text: 'Say: sun.', difficulty: 1 },
  ],
  bun: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A small round bread roll, often used for burgers.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He put the burger on a ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bun.', difficulty: 1 },
  ],
  bee: [
    { type: 'phonemic', text: 'It starts with /b/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A small flying insect that makes honey.', difficulty: 1 },
    { type: 'sentence_completion', text: 'A ___ buzzed around the flower.', difficulty: 1 },
    { type: 'repetition', text: 'Say: bee.', difficulty: 1 },
  ],
  dish: [
    { type: 'phonemic', text: 'It starts with /d/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A flat or shallow container you serve or eat food from.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She washed the ___ in the sink.', difficulty: 1 },
    { type: 'repetition', text: 'Say: dish.', difficulty: 1 },
  ],
  sock: [
    { type: 'phonemic', text: 'It starts with /s/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A soft piece of clothing you wear on your foot, inside your shoe.', difficulty: 1 },
    { type: 'sentence_completion', text: 'He pulled on a clean ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: sock.', difficulty: 1 },
  ],
  lock: [
    { type: 'phonemic', text: 'It starts with /l/ and has one syllable.', difficulty: 1 },
    { type: 'semantic', text: 'A device that keeps a door shut so only a key can open it.', difficulty: 1 },
    { type: 'sentence_completion', text: 'She turned the key in the ___.', difficulty: 1 },
    { type: 'repetition', text: 'Say: lock.', difficulty: 1 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Check whether a word has cue coverage in the bank.
 */
export function hasCueCoverage(word: string): boolean {
  return word.toLowerCase() in cueBank;
}

/**
 * Get all cue variants for a word (case-insensitive).
 */
export function getCuesForWord(
  word: string,
  preferredType?: CueBankType
): CueVariant[] {
  const variants = cueBank[word.toLowerCase()];
  if (!variants) return [];
  if (preferredType) {
    const preferred = variants.filter(v => v.type === preferredType);
    return preferred.length > 0 ? preferred : variants;
  }
  return variants;
}

/**
 * Get a single cue text for a word by type. Falls back gracefully.
 */
export function getCueText(
  word: string,
  type: CueBankType
): string | null {
  const variants = cueBank[word.toLowerCase()];
  if (!variants) return null;
  const match = variants.find(v => v.type === type);
  return match?.text ?? null;
}

/**
 * Get inventory stats for coverage reporting.
 */
export function getCueBankStats(): {
  totalWords: number;
  totalCues: number;
  byType: Record<CueBankType, number>;
  wordsWithFullCoverage: number;
} {
  const words = Object.keys(cueBank);
  const byType: Record<CueBankType, number> = {
    phonemic: 0,
    semantic: 0,
    sentence_completion: 0,
    repetition: 0,
  };
  let wordsWithFullCoverage = 0;
  let totalCues = 0;

  for (const variants of Object.values(cueBank)) {
    const types = new Set(variants.map(v => v.type));
    if (types.size >= 4) wordsWithFullCoverage++;
    for (const v of variants) {
      byType[v.type]++;
      totalCues++;
    }
  }

  return { totalWords: words.length, totalCues, byType, wordsWithFullCoverage };
}
