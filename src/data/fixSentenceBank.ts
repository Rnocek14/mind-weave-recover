/**
 * Fix the Sentence Bank
 * 
 * Sentences with one wrong word that the user must detect and replace.
 * Trains self-monitoring and error repair — critical for conversation recovery.
 * 
 * Error types:
 * - semantic_swap: same-category word (spoon → knife)
 * - category_error: wrong category entirely (pillow → soap)
 * - function_error: subtle function mismatch (coin → key)
 * - multiple_valid_repairs: multiple "best" answers exist
 */

import { getLevelContent, resolveCohortMix, sliceCohortByIntensity } from '@/lib/intensity';

export interface FixSentenceTrial {
  id: string;
  sentence: string;
  wrongWord: string;
  wrongWordIndex: number;
  acceptedFixes: string[];
  fixAliases: Record<string, string[]>;
  category: string;
  difficulty: 1 | 2 | 3;
  errorType: 'semantic_swap' | 'category_error' | 'function_error' | 'multiple_valid_repairs';
  /** Phoneme targets for adaptive phoneme-aware selection */
  phonemeTargets: string[];
}

export const FIX_SENTENCE_BANK: FixSentenceTrial[] = [
  // ══════════════ DIFFICULTY 1: Obvious category violations ══════════════
  {
    id: 'fs_1', sentence: 'I washed my hands with a pillow.', wrongWord: 'pillow', wrongWordIndex: 7,
    acceptedFixes: ['soap', 'towel'], fixAliases: { soap: ['so', 'soaps'], towel: ['towels', 'tal'] },
    category: 'bathroom', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/s/', '/p/', '/t/'],
  },
  {
    id: 'fs_2', sentence: 'I brushed my teeth with a hammer.', wrongWord: 'hammer', wrongWordIndex: 7,
    acceptedFixes: ['toothbrush', 'brush'], fixAliases: { toothbrush: ['tooth brush', 'toothbrushes'], brush: ['brushes'] },
    category: 'bathroom', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/b/', '/r/', '/ʃ/'],
  },
  {
    id: 'fs_3', sentence: 'I put on my shoes and tied the flowers.', wrongWord: 'flowers', wrongWordIndex: 9,
    acceptedFixes: ['laces', 'shoelaces'], fixAliases: { laces: ['lace', 'lays'], shoelaces: ['shoe laces'] },
    category: 'clothing', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/l/', '/s/', '/ʃ/'],
  },
  {
    id: 'fs_4', sentence: 'The dog wagged its book.', wrongWord: 'book', wrongWordIndex: 5,
    acceptedFixes: ['tail'], fixAliases: { tail: ['tale', 'tails'] },
    category: 'animals', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/t/', '/eɪ/', '/l/'],
  },
  {
    id: 'fs_5', sentence: 'I drove the car and turned the blanket.', wrongWord: 'blanket', wrongWordIndex: 9,
    acceptedFixes: ['wheel', 'steering wheel'], fixAliases: { wheel: ['wheels', 'weel'], 'steering wheel': ['steering'] },
    category: 'driving', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/w/', '/iː/', '/l/'],
  },
  {
    id: 'fs_6', sentence: 'The bird sang a beautiful lamp.', wrongWord: 'lamp', wrongWordIndex: 6,
    acceptedFixes: ['song', 'tune', 'melody'], fixAliases: { song: ['songs'], tune: ['tunes'] },
    category: 'nature', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/s/', '/ŋ/', '/t/'],
  },
  {
    id: 'fs_7', sentence: 'I turned off the chair before bed.', wrongWord: 'chair', wrongWordIndex: 5,
    acceptedFixes: ['light', 'lamp', 'tv', 'television'], fixAliases: { light: ['lights', 'lite'], lamp: ['lamps'], tv: ['t.v.', 'tee vee'] },
    category: 'home', difficulty: 1, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/l/', '/aɪ/', '/t/'],
  },
  {
    id: 'fs_8', sentence: 'She poured coffee into a shoe.', wrongWord: 'shoe', wrongWordIndex: 6,
    acceptedFixes: ['cup', 'mug', 'glass'], fixAliases: { cup: ['cups'], mug: ['mugs'], glass: ['glasses'] },
    category: 'kitchen', difficulty: 1, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/k/', '/ʌ/', '/p/', '/g/'],
  },
  {
    id: 'fs_9', sentence: 'I read a chair before sleeping.', wrongWord: 'chair', wrongWordIndex: 3,
    acceptedFixes: ['book', 'story', 'magazine'], fixAliases: { book: ['books'], story: ['stories'] },
    category: 'home', difficulty: 1, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/b/', '/ʊ/', '/k/'],
  },
  {
    id: 'fs_10', sentence: 'The baby was crying in the tree.', wrongWord: 'tree', wrongWordIndex: 7,
    acceptedFixes: ['crib', 'bed', 'stroller', 'room'], fixAliases: { crib: ['cribs', 'cred'], bed: ['beds'] },
    category: 'home', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/k/', '/r/', '/b/'],
  },

  // ══════════════ DIFFICULTY 2: Same-category swaps ══════════════
  {
    id: 'fs_11', sentence: 'I cut my steak with a spoon.', wrongWord: 'spoon', wrongWordIndex: 7,
    acceptedFixes: ['knife', 'fork'], fixAliases: { knife: ['knives', 'nife'], fork: ['forks'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/n/', '/aɪ/', '/f/', '/k/'],
  },
  {
    id: 'fs_12', sentence: 'I drank my water from a plate.', wrongWord: 'plate', wrongWordIndex: 7,
    acceptedFixes: ['glass', 'cup', 'bottle'], fixAliases: { glass: ['glasses'], cup: ['cups'], bottle: ['bottles'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/g/', '/l/', '/k/', '/b/'],
  },
  {
    id: 'fs_13', sentence: 'She put on her gloves and scarf and boots.', wrongWord: 'boots', wrongWordIndex: 9,
    acceptedFixes: ['hat', 'coat', 'jacket'], fixAliases: { hat: ['hats'], coat: ['coats'], jacket: ['jackets'] },
    category: 'clothing', difficulty: 2, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/h/', '/æ/', '/t/', '/k/'],
  },
  {
    id: 'fs_14', sentence: 'The cat chased the bird across the ceiling.', wrongWord: 'ceiling', wrongWordIndex: 8,
    acceptedFixes: ['yard', 'garden', 'lawn', 'floor', 'room'], fixAliases: { yard: ['yards'], garden: ['gardens'] },
    category: 'home', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/j/', '/ɑː/', '/d/', '/g/'],
  },
  {
    id: 'fs_15', sentence: 'I stirred the soup with a fork.', wrongWord: 'fork', wrongWordIndex: 7,
    acceptedFixes: ['spoon', 'ladle'], fixAliases: { spoon: ['spoons'], ladle: ['ladles', 'ladel'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/s/', '/p/', '/uː/', '/n/'],
  },
  {
    id: 'fs_16', sentence: 'He sat on the table and watched TV.', wrongWord: 'table', wrongWordIndex: 4,
    acceptedFixes: ['couch', 'sofa', 'chair'], fixAliases: { couch: ['couches'], sofa: ['sofas'], chair: ['chairs'] },
    category: 'furniture', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/k/', '/aʊ/', '/tʃ/', '/s/'],
  },
  {
    id: 'fs_17', sentence: 'I wrote a letter with a pencil and envelope.', wrongWord: 'pencil', wrongWordIndex: 7,
    acceptedFixes: ['pen'], fixAliases: { pen: ['pens', 'pin'] },
    category: 'office', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/ɛ/', '/n/'],
  },
  {
    id: 'fs_18', sentence: 'She hung the painting on the floor.', wrongWord: 'floor', wrongWordIndex: 7,
    acceptedFixes: ['wall'], fixAliases: { wall: ['walls', 'walled'] },
    category: 'home', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/w/', '/ɔː/', '/l/'],
  },
  {
    id: 'fs_19', sentence: 'The children played in the kitchen at recess.', wrongWord: 'kitchen', wrongWordIndex: 5,
    acceptedFixes: ['playground', 'yard', 'park', 'field'], fixAliases: { playground: ['play ground'], yard: ['yards'] },
    category: 'school', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/l/', '/j/', '/ɑː/'],
  },
  {
    id: 'fs_20', sentence: 'I peeled the banana and threw away the seeds.', wrongWord: 'seeds', wrongWordIndex: 10,
    acceptedFixes: ['peel', 'skin'], fixAliases: { peel: ['peels', 'peal'], skin: ['skins'] },
    category: 'food', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/iː/', '/l/', '/s/'],
  },

  // ══════════════ DIFFICULTY 3: Subtle function errors ══════════════
  {
    id: 'fs_21', sentence: 'I locked the door with a coin.', wrongWord: 'coin', wrongWordIndex: 7,
    acceptedFixes: ['key'], fixAliases: { key: ['keys', 'keep'] },
    category: 'home', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/k/', '/iː/'],
  },
  {
    id: 'fs_22', sentence: 'She dried her hair with a towel and a comb.', wrongWord: 'comb', wrongWordIndex: 10,
    acceptedFixes: ['dryer', 'hair dryer', 'blow dryer'], fixAliases: { dryer: ['drier', 'dryers'], 'hair dryer': ['hairdryer'], 'blow dryer': ['blow drier'] },
    category: 'bathroom', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/d/', '/r/', '/aɪ/'],
  },
  {
    id: 'fs_23', sentence: 'He hammered the nail with a screwdriver.', wrongWord: 'screwdriver', wrongWordIndex: 7,
    acceptedFixes: ['hammer'], fixAliases: { hammer: ['hammers'] },
    category: 'tools', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/h/', '/æ/', '/m/'],
  },
  {
    id: 'fs_24', sentence: 'I checked the temperature with a clock.', wrongWord: 'clock', wrongWordIndex: 7,
    acceptedFixes: ['thermometer'], fixAliases: { thermometer: ['thermometers', 'thermometre', 'the mom it er'] },
    category: 'health', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/θ/', '/ɜː/', '/m/'],
  },
  {
    id: 'fs_25', sentence: 'She measured the fabric with a pen.', wrongWord: 'pen', wrongWordIndex: 7,
    acceptedFixes: ['ruler', 'tape measure', 'measuring tape'], fixAliases: { ruler: ['rulers', 'rule her'], 'tape measure': ['tape'], 'measuring tape': ['measure'] },
    category: 'craft', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/r/', '/uː/', '/l/'],
  },
  {
    id: 'fs_26', sentence: 'The firefighter put out the fire with a blanket.', wrongWord: 'blanket', wrongWordIndex: 10,
    acceptedFixes: ['hose', 'water', 'extinguisher'], fixAliases: { hose: ['hoses', 'hoes'], water: ['waters'], extinguisher: ['fire extinguisher'] },
    category: 'emergency', difficulty: 3, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/h/', '/oʊ/', '/z/', '/w/'],
  },
  {
    id: 'fs_27', sentence: 'I mailed the letter without a stamp on the box.', wrongWord: 'box', wrongWordIndex: 11,
    acceptedFixes: ['envelope'], fixAliases: { envelope: ['envelopes', 'envelop'] },
    category: 'office', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/ɛ/', '/n/', '/v/'],
  },
  {
    id: 'fs_28', sentence: 'She watered the plants with a bucket instead of a cup.', wrongWord: 'cup', wrongWordIndex: 11,
    acceptedFixes: ['watering can', 'hose', 'sprinkler'], fixAliases: { 'watering can': ['watering'], hose: ['hoses'] },
    category: 'garden', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/w/', '/ɔː/', '/h/'],
  },
  {
    id: 'fs_29', sentence: 'He tightened the bolt with a knife.', wrongWord: 'knife', wrongWordIndex: 7,
    acceptedFixes: ['wrench', 'spanner', 'pliers'], fixAliases: { wrench: ['wrenches', 'ranch'], spanner: ['spanners'] },
    category: 'tools', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/r/', '/ɛ/', '/n/', '/tʃ/'],
  },
  {
    id: 'fs_30', sentence: 'I sewed the button with a pencil.', wrongWord: 'pencil', wrongWordIndex: 7,
    acceptedFixes: ['needle', 'needle and thread'], fixAliases: { needle: ['needles', 'noodle'], 'needle and thread': ['thread'] },
    category: 'craft', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/n/', '/iː/', '/d/', '/l/'],
  },

  // ══════════════ TIER 1 EXPANSION (engine L1–L3): obvious cross-category errors ══════════════
  {
    id: 'fs_31', sentence: 'I ate my soup with a sock.', wrongWord: 'sock', wrongWordIndex: 6,
    acceptedFixes: ['spoon'], fixAliases: { spoon: ['spoons', 'spune'] },
    category: 'kitchen', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/s/', '/p/', '/uː/', '/n/'],
  },
  {
    id: 'fs_32', sentence: 'I sat down on a sandwich.', wrongWord: 'sandwich', wrongWordIndex: 5,
    acceptedFixes: ['chair', 'couch', 'sofa', 'bench'], fixAliases: { chair: ['chairs'], couch: ['couches'], sofa: ['sofas'] },
    category: 'furniture', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/tʃ/', '/ɛ/', '/r/'],
  },
  {
    id: 'fs_33', sentence: 'I opened the door with my elbow.', wrongWord: 'elbow', wrongWordIndex: 6,
    acceptedFixes: ['hand', 'hands', 'key'], fixAliases: { hand: ['hands'], key: ['keys'] },
    category: 'home', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/h/', '/æ/', '/n/', '/d/'],
  },
  {
    id: 'fs_34', sentence: 'The fish swam in the sky.', wrongWord: 'sky', wrongWordIndex: 5,
    acceptedFixes: ['water', 'pond', 'lake', 'ocean', 'sea'], fixAliases: { water: ['waters'], pond: ['ponds'], ocean: ['oceans'] },
    category: 'nature', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/w/', '/ɔː/', '/t/', '/r/'],
  },
  {
    id: 'fs_35', sentence: 'I wore a hat on my foot.', wrongWord: 'foot', wrongWordIndex: 6,
    acceptedFixes: ['head'], fixAliases: { head: ['heads'] },
    category: 'body', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/h/', '/ɛ/', '/d/'],
  },
  {
    id: 'fs_36', sentence: 'She drank a glass of bread.', wrongWord: 'bread', wrongWordIndex: 5,
    acceptedFixes: ['water', 'milk', 'juice', 'wine'], fixAliases: { water: ['waters'], milk: ['milks'], juice: ['juices'] },
    category: 'food', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/w/', '/m/', '/dʒ/'],
  },
  {
    id: 'fs_37', sentence: 'The car drove down the river.', wrongWord: 'river', wrongWordIndex: 5,
    acceptedFixes: ['road', 'street', 'highway', 'lane'], fixAliases: { road: ['roads'], street: ['streets'], highway: ['highways'] },
    category: 'driving', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/r/', '/oʊ/', '/d/', '/s/'],
  },
  {
    id: 'fs_38', sentence: 'I cooked the eggs in a hat.', wrongWord: 'hat', wrongWordIndex: 6,
    acceptedFixes: ['pan', 'skillet', 'pot'], fixAliases: { pan: ['pans'], skillet: ['skillets'], pot: ['pots'] },
    category: 'kitchen', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/p/', '/æ/', '/n/'],
  },
  {
    id: 'fs_39', sentence: 'The dentist cleaned my shoes.', wrongWord: 'shoes', wrongWordIndex: 4,
    acceptedFixes: ['teeth'], fixAliases: { teeth: ['tooth'] },
    category: 'health', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/t/', '/iː/', '/θ/'],
  },
  {
    id: 'fs_40', sentence: 'I cut the paper with a banana.', wrongWord: 'banana', wrongWordIndex: 6,
    acceptedFixes: ['scissors', 'knife'], fixAliases: { scissors: ['scissor'], knife: ['knives'] },
    category: 'office', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/s/', '/ɪ/', '/z/'],
  },

  // ══════════════ TIER 2 EXPANSION (engine L4–L7): same-category swaps, longer sentences ══════════════
  {
    id: 'fs_41', sentence: 'I sliced the bread with a spoon from the drawer.', wrongWord: 'spoon', wrongWordIndex: 6,
    acceptedFixes: ['knife'], fixAliases: { knife: ['knives', 'nife'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/n/', '/aɪ/', '/f/'],
  },
  {
    id: 'fs_42', sentence: 'After dinner she rinsed the plates and dried each cup with a fork.', wrongWord: 'fork', wrongWordIndex: 12,
    acceptedFixes: ['towel', 'cloth', 'rag'], fixAliases: { towel: ['towels'], cloth: ['cloths'], rag: ['rags'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/t/', '/aʊ/', '/əl/'],
  },
  {
    id: 'fs_43', sentence: 'He grabbed his keys, his wallet, and his shirt before driving to work.', wrongWord: 'shirt', wrongWordIndex: 8,
    acceptedFixes: ['phone', 'jacket', 'coat', 'glasses'], fixAliases: { phone: ['phones'], jacket: ['jackets'] },
    category: 'daily', difficulty: 2, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/f/', '/oʊ/', '/n/'],
  },
  {
    id: 'fs_44', sentence: 'She walked into the bedroom and turned on the oven before getting dressed.', wrongWord: 'oven', wrongWordIndex: 9,
    acceptedFixes: ['light', 'lamp', 'fan', 'tv', 'television'], fixAliases: { light: ['lights'], lamp: ['lamps'], tv: ['t.v.'] },
    category: 'home', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/l/', '/aɪ/', '/t/'],
  },
  {
    id: 'fs_45', sentence: 'The waiter brought the menu and a glass of wine to our window.', wrongWord: 'window', wrongWordIndex: 12,
    acceptedFixes: ['table', 'booth', 'seat'], fixAliases: { table: ['tables'], booth: ['booths'], seat: ['seats'] },
    category: 'restaurant', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/t/', '/eɪ/', '/b/', '/əl/'],
  },
  {
    id: 'fs_46', sentence: 'I packed the suitcase with shirts, pants, socks, and dishes for my trip.', wrongWord: 'dishes', wrongWordIndex: 10,
    acceptedFixes: ['shoes', 'underwear', 'sweaters', 'jackets'], fixAliases: { shoes: ['shoe'], sweaters: ['sweater'] },
    category: 'travel', difficulty: 2, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/ʃ/', '/uː/', '/z/'],
  },
  {
    id: 'fs_47', sentence: 'He turned the key, started the engine, and pressed the keyboard to drive away.', wrongWord: 'keyboard', wrongWordIndex: 10,
    acceptedFixes: ['gas', 'pedal', 'accelerator', 'gas pedal'], fixAliases: { gas: ['gases'], pedal: ['pedals'] },
    category: 'driving', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/ɛ/', '/d/', '/əl/'],
  },
  {
    id: 'fs_48', sentence: 'The teacher wrote the math problem on the carpet for the whole class.', wrongWord: 'carpet', wrongWordIndex: 8,
    acceptedFixes: ['board', 'whiteboard', 'blackboard', 'chalkboard'], fixAliases: { board: ['boards'], whiteboard: ['white board'] },
    category: 'school', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/b/', '/ɔː/', '/r/', '/d/'],
  },
  {
    id: 'fs_49', sentence: 'She put the laundry in the refrigerator and turned the dial to start.', wrongWord: 'refrigerator', wrongWordIndex: 6,
    acceptedFixes: ['washer', 'washing machine', 'dryer'], fixAliases: { washer: ['washers'], 'washing machine': ['washing'] },
    category: 'home', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/w/', '/ɑː/', '/ʃ/', '/r/'],
  },
  {
    id: 'fs_50', sentence: 'Before the meeting she opened her laptop, took out her notes, and sharpened her shoe.', wrongWord: 'shoe', wrongWordIndex: 14,
    acceptedFixes: ['pencil', 'pen'], fixAliases: { pencil: ['pencils'], pen: ['pens'] },
    category: 'office', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/ɛ/', '/n/', '/s/', '/əl/'],
  },

  // ══════════════ TIER 3 EXPANSION (engine L8–L10): subtle function errors, complex sentences ══════════════
  {
    id: 'fs_51', sentence: 'After the storm passed I swept the broken glass off the porch with a brush.', wrongWord: 'brush', wrongWordIndex: 14,
    acceptedFixes: ['broom', 'dustpan'], fixAliases: { broom: ['brooms'], dustpan: ['dust pan', 'dustpans'] },
    category: 'home', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/b/', '/r/', '/uː/', '/m/'],
  },
  {
    id: 'fs_52', sentence: 'The chef seasoned the chicken, set the table, and lit the table with a match.', wrongWord: 'table', wrongWordIndex: 11,
    acceptedFixes: ['candle', 'candles', 'fire', 'fireplace'], fixAliases: { candle: ['candles'], fireplace: ['fire place'] },
    category: 'kitchen', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/k/', '/æ/', '/n/', '/d/', '/əl/'],
  },
  {
    id: 'fs_53', sentence: 'When the bread was done she pulled the tray out of the freezer using oven mitts.', wrongWord: 'freezer', wrongWordIndex: 11,
    acceptedFixes: ['oven', 'stove'], fixAliases: { oven: ['ovens'], stove: ['stoves'] },
    category: 'kitchen', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/ʌ/', '/v/', '/ə/', '/n/'],
  },
  {
    id: 'fs_54', sentence: 'The mechanic raised the car on the lift, opened the hood, and drained the oil into a plate.', wrongWord: 'plate', wrongWordIndex: 16,
    acceptedFixes: ['pan', 'bucket', 'container', 'tray'], fixAliases: { pan: ['pans'], bucket: ['buckets'], container: ['containers'] },
    category: 'tools', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/p/', '/æ/', '/n/', '/b/'],
  },
  {
    id: 'fs_55', sentence: 'He gathered his fishing pole, a tackle box, some bait, and a piano before heading to the lake.', wrongWord: 'piano', wrongWordIndex: 13,
    acceptedFixes: ['cooler', 'net', 'bucket', 'chair', 'rod'], fixAliases: { cooler: ['coolers'], net: ['nets'] },
    category: 'outdoor', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/k/', '/uː/', '/l/', '/r/'],
  },
  {
    id: 'fs_56', sentence: 'The nurse cleaned the wound, applied antiseptic, and wrapped it tightly with a rope.', wrongWord: 'rope', wrongWordIndex: 13,
    acceptedFixes: ['bandage', 'gauze', 'wrap'], fixAliases: { bandage: ['bandages', 'band aid', 'bandaid'], gauze: ['gauzes'] },
    category: 'health', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/b/', '/æ/', '/n/', '/d/', '/ɪ/', '/dʒ/'],
  },
  {
    id: 'fs_57', sentence: 'After raking the leaves into a large pile she scooped them into the freezer to take out back.', wrongWord: 'freezer', wrongWordIndex: 14,
    acceptedFixes: ['bag', 'wheelbarrow', 'bin', 'trash bag', 'cart'], fixAliases: { bag: ['bags'], bin: ['bins'], wheelbarrow: ['wheel barrow'] },
    category: 'garden', difficulty: 3, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/b/', '/æ/', '/g/'],
  },
  {
    id: 'fs_58', sentence: 'She poured the dry pasta into a pot of boiling milk and stirred it with a spoon.', wrongWord: 'milk', wrongWordIndex: 9,
    acceptedFixes: ['water'], fixAliases: { water: ['waters'] },
    category: 'kitchen', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/w/', '/ɔː/', '/t/', '/r/'],
  },
  {
    id: 'fs_59', sentence: 'The painter set up the ladder, taped the trim, and rolled the wall using a sponge.', wrongWord: 'sponge', wrongWordIndex: 14,
    acceptedFixes: ['roller', 'brush', 'paint roller', 'paintbrush'], fixAliases: { roller: ['rollers', 'roll her'], brush: ['brushes'] },
    category: 'tools', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/r/', '/oʊ/', '/l/', '/r/'],
  },
  {
    id: 'fs_60', sentence: 'Before the guests arrived she vacuumed the rugs, wiped the counters, and watered the carpet.', wrongWord: 'carpet', wrongWordIndex: 13,
    acceptedFixes: ['plants', 'flowers', 'garden'], fixAliases: { plants: ['plant'], flowers: ['flower'], garden: ['gardens'] },
    category: 'home', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/p/', '/l/', '/æ/', '/n/', '/t/'],
  },
];

/**
 * Get trials filtered by difficulty and optionally by phoneme targets
 */
/**
 * Map an engine difficulty (1..10) to the FixSentence content tier (1..3).
 * Until L4-L10 content lands, the bank only has 3 tiers; this collapse is
 * explicit and centralized so callers can pass either a tier or an engine level.
 */
function toFixSentenceTier(d: number): 1 | 2 | 3 {
  if (!Number.isFinite(d)) return 2;
  if (d <= 3) return 1;
  if (d <= 7) return 2;
  return 3;
}

/** Sentence length in words (cheap, computed on demand). */
function sentenceWordCount(t: FixSentenceTrial): number {
  return t.sentence.split(/\s+/).filter(Boolean).length;
}

/**
 * FixSentence intensity hardness key — sort within an errorType cohort by:
 *   sentenceLength → wrongWordIndex
 * Errors late in a longer sentence are harder (more working-memory load).
 */
function fixSentenceHardness(t: FixSentenceTrial): number {
  const len = sentenceWordCount(t);
  // Combine into one monotonic number. Length dominates; index breaks ties.
  return len * 100 + t.wrongWordIndex;
}

export function getFixSentenceTrials(options?: {
  /** Tier 1..3 OR engine level 1..10. Both are accepted; engine levels collapse to a tier. */
  difficulty?: number;
  count?: number;
  focusPhonemes?: string[];
  /** IDs recently shown — selector will prefer fresh items, falling back to LRU. */
  recentIds?: string[];
}): FixSentenceTrial[] {
  const requested = options?.count ?? FIX_SENTENCE_BANK.length;

  // ── Intensity-driven selection (May 2026) ──────────────────────────────
  // When `difficulty` is an engine level (1..10), use the per-game intensity
  // ladder to pick cohort(s) by errorType + sub-tier slice.
  // Falls back to the legacy tier-bucket selector otherwise (or when the
  // intensity registry has no entry — defensive).
  let pool: FixSentenceTrial[];

  if (options?.difficulty != null) {
    const spec = getLevelContent('fix-sentence', options.difficulty);


    if (spec) {
      // Cohort key = FixSentenceTrial.errorType (one of four).
      const seen = new Set<string>();
      const buf: FixSentenceTrial[] = [];
      for (const slice of resolveCohortMix(spec, requested)) {
        const cohortPool = FIX_SENTENCE_BANK.filter(t => t.errorType === slice.cohort);
        if (cohortPool.length === 0) continue;
        const sliced = sliceCohortByIntensity(
          cohortPool,
          fixSentenceHardness,
          spec.subTierIndex,
          Math.max(slice.count * 3, 6)
        );
        for (const t of sliced) {
          if (!seen.has(t.id)) { seen.add(t.id); buf.push(t); }
        }
      }
      // Safety: if intensity cohorts produced nothing usable, widen to all
      // items at the level's mapped tier.
      if (buf.length === 0) {
        const targetTier = toFixSentenceTier(options.difficulty);
        pool = FIX_SENTENCE_BANK.filter(t => t.difficulty === targetTier);
      } else {
        pool = buf;
      }
    } else {
      // Legacy fallback — strict tier bucket with hardest-neighbor padding.
      const targetTier = toFixSentenceTier(options.difficulty);
      const exact = FIX_SENTENCE_BANK.filter(t => t.difficulty === targetTier);
      if (exact.length >= requested) {
        pool = exact;
      } else {
        const neighbors: number[] =
          targetTier === 1 ? [2, 3] :
          targetTier === 3 ? [2, 1] :
          [3, 1];
        const padded = [...exact];
        for (const n of neighbors) {
          if (padded.length >= requested) break;
          padded.push(...FIX_SENTENCE_BANK.filter(t => t.difficulty === n));
        }
        pool = padded;
      }
    }
  } else {
    pool = [...FIX_SENTENCE_BANK];
  }

  let trials = [...pool];

  // Phoneme-aware prioritization: sort phoneme-matching trials first
  if (options?.focusPhonemes && options.focusPhonemes.length > 0) {
    const focus = new Set(options.focusPhonemes);
    const matched = trials.filter(t => t.phonemeTargets.some(p => focus.has(p)));
    const unmatched = trials.filter(t => !t.phonemeTargets.some(p => focus.has(p)));
    for (const arr of [matched, unmatched]) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    trials = [...matched, ...unmatched];
  } else {
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }
  }

  // Recency exclusion (soft): prefer items not in recentIds. If everything
  // is recent, fall back to least-recently-used order so we never starve.
  if (options?.recentIds && options.recentIds.length > 0) {
    const recentSet = new Set(options.recentIds);
    const fresh = trials.filter(t => !recentSet.has(t.id));
    const recent = trials.filter(t => recentSet.has(t.id));
    // Order recent fallbacks by oldest-first using their position in recentIds.
    const ageIndex = new Map(options.recentIds.map((id, i) => [id, i]));
    recent.sort((a, b) => (ageIndex.get(a.id) ?? 0) - (ageIndex.get(b.id) ?? 0));
    trials = [...fresh, ...recent];
    if (typeof window !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[recency:fix_sentence] fresh=%d recent=%d total=%d', fresh.length, recent.length, trials.length);
    }
  }

  if (options?.count) {
    trials = trials.slice(0, options.count);
  }

  return trials;
}

