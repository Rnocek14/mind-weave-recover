/**
 * Minimal Pairs Bank
 * 
 * Curated minimal pairs for phoneme discrimination practice.
 * Each pair differs by a single phoneme, targeting specific contrasts.
 */

import { PHOTO_BANK, PhotoTrial } from './photoBank';
import { getLevelContent, sliceCohortByIntensity } from '@/lib/intensity';

export interface MinimalPair {
  id: string;
  word1: string;
  word2: string;
  contrastType: 'initial' | 'medial' | 'final';
  phoneme1: string;
  phoneme2: string;
  contrastDescription: string;
  difficulty: number; // 1-3 (easy, medium, hard)
  category: string;
}

// Define our minimal pairs with their phonemic contrasts
export const MINIMAL_PAIRS: MinimalPair[] = [
  // Initial consonant contrasts
  {
    id: 'cat_hat',
    word1: 'cat',
    word2: 'hat',
    contrastType: 'initial',
    phoneme1: '/k/',
    phoneme2: '/h/',
    contrastDescription: 'Voiceless velar stop vs. voiceless glottal fricative',
    difficulty: 1,
    category: 'stop_fricative',
  },
  {
    id: 'ship_chip',
    word1: 'ship',
    word2: 'chip',
    contrastType: 'initial',
    phoneme1: '/ʃ/',
    phoneme2: '/tʃ/',
    contrastDescription: 'Voiceless palato-alveolar fricative vs. affricate',
    difficulty: 2,
    category: 'fricative_affricate',
  },
  {
    id: 'fan_van',
    word1: 'fan',
    word2: 'van',
    contrastType: 'initial',
    phoneme1: '/f/',
    phoneme2: '/v/',
    contrastDescription: 'Voiceless vs. voiced labiodental fricative',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'three_tree',
    word1: 'three',
    word2: 'tree',
    contrastType: 'initial',
    phoneme1: '/θ/',
    phoneme2: '/t/',
    contrastDescription: 'Voiceless dental fricative vs. alveolar stop',
    difficulty: 3,
    category: 'fricative_stop',
  },
  {
    id: 'goat_coat',
    word1: 'goat',
    word2: 'coat',
    contrastType: 'initial',
    phoneme1: '/ɡ/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'pen_hen',
    word1: 'pen',
    word2: 'hen',
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/h/',
    contrastDescription: 'Voiceless bilabial stop vs. glottal fricative',
    difficulty: 1,
    category: 'stop_fricative',
  },
  
  // Vowel contrasts
  // NOTE: 'bed_red' removed — red.jpg depicts a red apple, so the pair rendered
  // a bed photo next to an apple. "red" stays out until a true red swatch exists.

  
  // Voicing contrasts (initial)
  {
    id: 'pin_bin',
    word1: 'pin',
    word2: 'bin',
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'Voiceless vs. voiced bilabial stop',
    difficulty: 2,
    category: 'voicing',
  },
  
  // Final voicing contrasts
  {
    id: 'cap_cab',
    word1: 'cap',
    word2: 'cab',
    contrastType: 'final',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'Voiceless vs. voiced bilabial stop (final position)',
    difficulty: 3,
    category: 'final_voicing',
  },
  
  // Fricative contrasts (θ vs ð)
  {
    id: 'teeth_teethe',
    word1: 'teeth',
    word2: 'teethe',
    contrastType: 'final',
    phoneme1: '/θ/',
    phoneme2: '/ð/',
    contrastDescription: 'Voiceless vs. voiced dental fricative',
    difficulty: 3,
    category: 'th_contrast',
  },
  
  // /ʒ/ contrasts (zh sound as in "measure")
  {
    id: 'measure_treasure',
    word1: 'measure',
    word2: 'treasure',
    contrastType: 'medial',
    phoneme1: '/ʒ/',
    phoneme2: '/ʒ/',
    contrastDescription: 'Both contain voiced postalveolar fricative (/ʒ/)',
    difficulty: 2,
    category: 'zh_sound',
  },
  
  // NOTE: 'yawn_yell' removed — both photos show a wide-open mouth and are
  // visually indistinguishable. Also both words start with /j/ (not a true
  // single-phoneme contrast). Drop until distinct artwork exists.

  
  // New minimal pairs using expanded photo bank
  {
    id: 'gate_Kate',
    word1: 'gate',
    word2: 'Kate',
    contrastType: 'initial',
    phoneme1: '/g/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'rose_nose',
    word1: 'rose',
    word2: 'nose',
    contrastType: 'initial',
    phoneme1: '/r/',
    phoneme2: '/n/',
    contrastDescription: 'Alveolar approximant vs. nasal',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'net_nut',
    word1: 'net',
    word2: 'nut',
    contrastType: 'medial',
    phoneme1: '/ɛ/',
    phoneme2: '/ʌ/',
    contrastDescription: 'Open-mid front vs. open-mid central vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'pie_tie',
    word1: 'pie',
    word2: 'tie',
    contrastType: 'initial',
    phoneme1: '/p/',
    phoneme2: '/t/',
    contrastDescription: 'Bilabial vs. alveolar voiceless stop',
    difficulty: 1,
    category: 'place',
  },
  {
    id: 'rope_robe',
    word1: 'rope',
    word2: 'robe',
    contrastType: 'final',
    phoneme1: '/p/',
    phoneme2: '/b/',
    contrastDescription: 'Voiceless vs. voiced bilabial stop (final)',
    difficulty: 3,
    category: 'final_voicing',
  },
  {
    id: 'duck_dock',
    word1: 'duck',
    word2: 'dock',
    contrastType: 'medial',
    phoneme1: '/ʌ/',
    phoneme2: '/ɑ/',
    contrastDescription: 'Open-mid central vs. open back vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'zip_sip',
    word1: 'zip',
    word2: 'sip',
    contrastType: 'initial',
    phoneme1: '/z/',
    phoneme2: '/s/',
    contrastDescription: 'Voiced vs. voiceless alveolar fricative',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'lion_lime',
    word1: 'lion',
    word2: 'lime',
    contrastType: 'final',
    phoneme1: '/n/',
    phoneme2: '/m/',
    contrastDescription: 'Alveolar vs. bilabial nasal',
    difficulty: 2,
    category: 'nasal',
  },
  
  // Batch 2 minimal pairs - medial/final position contrasts
  {
    id: 'bag_bat',
    word1: 'bag',
    word2: 'bat',
    contrastType: 'final',
    phoneme1: '/g/',
    phoneme2: '/t/',
    contrastDescription: 'Velar vs. alveolar stop (final)',
    difficulty: 2,
    category: 'place',
  },
  {
    id: 'pig_pin',
    word1: 'pig',
    word2: 'pin',
    contrastType: 'final',
    phoneme1: '/g/',
    phoneme2: '/n/',
    contrastDescription: 'Velar stop vs. alveolar nasal (final)',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'bell_ball',
    word1: 'bell',
    word2: 'ball',
    contrastType: 'medial',
    phoneme1: '/ɛ/',
    phoneme2: '/ɔ/',
    contrastDescription: 'Open-mid front vs. open-mid back vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'carrot_parrot',
    word1: 'carrot',
    word2: 'parrot',
    contrastType: 'initial',
    phoneme1: '/k/',
    phoneme2: '/p/',
    contrastDescription: 'Velar vs. bilabial voiceless stop',
    difficulty: 2,
    category: 'place',
  },
  {
    id: 'frog_flag',
    word1: 'frog',
    word2: 'flag',
    contrastType: 'medial',
    phoneme1: '/r/',
    phoneme2: '/l/',
    contrastDescription: 'Alveolar approximant vs. lateral (/r/ vs /l/)',
    difficulty: 3,
    category: 'liquid',
  },
  {
    id: 'puzzle_puddle',
    word1: 'puzzle',
    word2: 'puddle',
    contrastType: 'medial',
    phoneme1: '/z/',
    phoneme2: '/d/',
    contrastDescription: 'Alveolar fricative vs. alveolar stop',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'tiger_liger',
    word1: 'tiger',
    word2: 'liger',
    contrastType: 'initial',
    phoneme1: '/t/',
    phoneme2: '/l/',
    contrastDescription: 'Alveolar stop vs. lateral approximant',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'towel_vowel',
    word1: 'towel',
    word2: 'vowel',
    contrastType: 'initial',
    phoneme1: '/t/',
    phoneme2: '/v/',
    contrastDescription: 'Alveolar stop vs. labiodental fricative',
    difficulty: 3,
    category: 'manner',
  },
  
  // ============================================
  // BATCH 3: Contrast Expansion (targeting 50+)
  // ============================================
  
  // /d/ vs /t/ — voicing contrast
  {
    id: 'duck_truck',
    word1: 'duck',
    word2: 'truck',
    contrastType: 'initial',
    phoneme1: '/d/',
    phoneme2: '/t/',
    contrastDescription: 'Voiced vs. voiceless alveolar stop (cluster onset)',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'bed_bet',
    word1: 'bed',
    word2: 'net',
    contrastType: 'initial',
    phoneme1: '/b/',
    phoneme2: '/n/',
    contrastDescription: 'Bilabial stop vs. alveolar nasal',
    difficulty: 1,
    category: 'manner',
  },
  
  // /v/ vs /f/ — voicing
  {
    id: 'van_fan',
    word1: 'van',
    word2: 'fan',
    contrastType: 'initial',
    phoneme1: '/v/',
    phoneme2: '/f/',
    contrastDescription: 'Voiced vs. voiceless labiodental fricative',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'vest_nest',
    word1: 'vest',
    word2: 'nest',
    contrastType: 'initial',
    phoneme1: '/v/',
    phoneme2: '/n/',
    contrastDescription: 'Labiodental fricative vs. alveolar nasal',
    difficulty: 2,
    category: 'manner',
  },
  {
    id: 'vase_face',
    word1: 'vase',
    word2: 'face',
    contrastType: 'initial',
    phoneme1: '/v/',
    phoneme2: '/f/',
    contrastDescription: 'Voiced vs. voiceless labiodental fricative',
    difficulty: 2,
    category: 'voicing',
  },
  
  // /l/ vs /r/ — liquid contrast (high clinical value)
  {
    id: 'leaf_reef',
    word1: 'leaf',
    word2: 'reef',
    contrastType: 'initial',
    phoneme1: '/l/',
    phoneme2: '/r/',
    contrastDescription: 'Lateral vs. alveolar approximant',
    difficulty: 3,
    category: 'liquid',
  },
  {
    id: 'lamp_ramp',
    word1: 'lamp',
    word2: 'ramp',
    contrastType: 'initial',
    phoneme1: '/l/',
    phoneme2: '/r/',
    contrastDescription: 'Lateral vs. alveolar approximant',
    difficulty: 3,
    category: 'liquid',
  },
  {
    id: 'lion_iron',
    word1: 'lion',
    word2: 'iron',
    contrastType: 'initial',
    phoneme1: '/l/',
    phoneme2: '/aɪ/',
    contrastDescription: 'Lateral approximant vs. diphthong onset',
    difficulty: 3,
    category: 'liquid',
  },
  {
    id: 'bell_bear',
    word1: 'bell',
    word2: 'bird',
    contrastType: 'initial',
    phoneme1: '/b/',
    phoneme2: '/b/',
    contrastDescription: 'Same onset, different vowel+coda (/ɛl/ vs /ɜrd/)',
    difficulty: 2,
    category: 'vowel',
  },
  
  // /b/ vs /p/ — more voicing pairs
  {
    id: 'bin_pin',
    word1: 'bin',
    word2: 'pin',
    contrastType: 'initial',
    phoneme1: '/b/',
    phoneme2: '/p/',
    contrastDescription: 'Voiced vs. voiceless bilabial stop',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'bag_back',
    word1: 'bag',
    word2: 'back',
    contrastType: 'final',
    phoneme1: '/g/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop (final)',
    difficulty: 3,
    category: 'final_voicing',
  },
  
  // /tʃ/ vs /ʃ/ — affricate vs fricative
  {
    id: 'chip_ship',
    word1: 'chip',
    word2: 'ship',
    contrastType: 'initial',
    phoneme1: '/tʃ/',
    phoneme2: '/ʃ/',
    contrastDescription: 'Voiceless affricate vs. fricative',
    difficulty: 2,
    category: 'fricative_affricate',
  },
  {
    id: 'cheese_she',
    word1: 'cheese',
    word2: 'shoe',
    contrastType: 'initial',
    phoneme1: '/tʃ/',
    phoneme2: '/ʃ/',
    contrastDescription: 'Voiceless affricate vs. fricative',
    difficulty: 2,
    category: 'fricative_affricate',
  },
  
  // /g/ vs /k/ — more pairs
  {
    id: 'gate_cake',
    word1: 'gate',
    word2: 'cake',
    contrastType: 'initial',
    phoneme1: '/g/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop',
    difficulty: 2,
    category: 'voicing',
  },
  {
    id: 'glove_clove',
    word1: 'glove',
    word2: 'clove',
    contrastType: 'initial',
    phoneme1: '/g/',
    phoneme2: '/k/',
    contrastDescription: 'Voiced vs. voiceless velar stop (cluster)',
    difficulty: 3,
    category: 'voicing',
  },
  
  // /z/ vs /s/
  {
    id: 'zoo_sue',
    word1: 'zoo',
    word2: 'shoe',
    contrastType: 'initial',
    phoneme1: '/z/',
    phoneme2: '/ʃ/',
    contrastDescription: 'Alveolar fricative vs. postalveolar fricative',
    difficulty: 2,
    category: 'place',
  },
  {
    id: 'nose_note',
    word1: 'nose',
    word2: 'note',
    contrastType: 'final',
    phoneme1: '/z/',
    phoneme2: '/t/',
    contrastDescription: 'Alveolar fricative vs. stop (final)',
    difficulty: 2,
    category: 'manner',
  },
  
  // Vowel contrasts (medial)
  {
    id: 'cap_cup',
    word1: 'cap',
    word2: 'cup',
    contrastType: 'medial',
    phoneme1: '/æ/',
    phoneme2: '/ʌ/',
    contrastDescription: 'Near-open front vs. open-mid central vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'hat_hot',
    word1: 'hat',
    word2: 'hut',
    contrastType: 'medial',
    phoneme1: '/æ/',
    phoneme2: '/ʌ/',
    contrastDescription: 'Near-open front vs. open-mid central vowel',
    difficulty: 2,
    category: 'vowel',
  },
  {
    id: 'pin_pen',
    word1: 'pin',
    word2: 'pen',
    contrastType: 'medial',
    phoneme1: '/ɪ/',
    phoneme2: '/ɛ/',
    contrastDescription: 'Near-close front vs. open-mid front vowel',
    difficulty: 3,
    category: 'vowel',
  },
  {
    id: 'coat_cat',
    word1: 'coat',
    word2: 'cat',
    contrastType: 'medial',
    phoneme1: '/oʊ/',
    phoneme2: '/æ/',
    contrastDescription: 'Mid back diphthong vs. near-open front vowel',
    difficulty: 1,
    category: 'vowel',
  },
  // ─── T3 expansion (Phase 2, Apr 2026) ─────────────────────────────
  // Acoustically-near contrasts. All photo-backed via Phase-2 PHOTO_BANK additions.
  {
    id: 'mouth_mouse',
    word1: 'mouth',
    word2: 'mouse',
    contrastType: 'final',
    phoneme1: '/θ/',
    phoneme2: '/s/',
    contrastDescription: 'Voiceless dental fricative vs. voiceless alveolar fricative (final)',
    difficulty: 3,
    category: 'th_contrast',
  },
  {
    id: 'fork_pork',
    word1: 'fork',
    word2: 'pork',
    contrastType: 'initial',
    phoneme1: '/f/',
    phoneme2: '/p/',
    contrastDescription: 'Voiceless labiodental fricative vs. voiceless bilabial stop',
    difficulty: 3,
    category: 'fricative_stop',
  },
  {
    id: 'sheep_ship',
    word1: 'sheep',
    word2: 'ship',
    contrastType: 'medial',
    phoneme1: '/iː/',
    phoneme2: '/ɪ/',
    contrastDescription: 'Tense vs. lax high-front vowel',
    difficulty: 3,
    category: 'vowel',
  },
  {
    id: 'ham_lamb',
    word1: 'ham',
    word2: 'lamb',
    contrastType: 'initial',
    phoneme1: '/h/',
    phoneme2: '/l/',
    contrastDescription: 'Voiceless glottal fricative vs. alveolar lateral approximant',
    difficulty: 3,
    category: 'liquid',
  },
  {
    id: 'wreath_reef',
    word1: 'wreath',
    word2: 'reef',
    contrastType: 'final',
    phoneme1: '/θ/',
    phoneme2: '/f/',
    contrastDescription: 'Voiceless dental fricative vs. voiceless labiodental fricative (final)',
    difficulty: 3,
    category: 'th_contrast',
  },
  // ─── T1 expansion — Phase 2 (Apr 2026) ─────────────────────────────
  // Acoustically-far contrasts to bring the warm-up (T1) playable pool ≥15.
  {
    id: 'sun_bun',
    word1: 'sun', word2: 'bun',
    contrastType: 'initial',
    phoneme1: '/s/', phoneme2: '/b/',
    contrastDescription: 'Voiceless alveolar fricative vs. voiced bilabial stop',
    difficulty: 1, category: 'stop_fricative',
  },
  {
    id: 'moon_spoon',
    word1: 'moon', word2: 'spoon',
    contrastType: 'initial',
    phoneme1: '/m/', phoneme2: '/sp/',
    contrastDescription: 'Bilabial nasal vs. /s/+stop cluster',
    difficulty: 1, category: 'nasal_cluster',
  },
  {
    id: 'bee_key',
    word1: 'bee', word2: 'key',
    contrastType: 'initial',
    phoneme1: '/b/', phoneme2: '/k/',
    contrastDescription: 'Voiced bilabial stop vs. voiceless velar stop',
    difficulty: 1, category: 'place',
  },
  {
    id: 'nose_rose',
    word1: 'nose', word2: 'rose',
    contrastType: 'initial',
    phoneme1: '/n/', phoneme2: '/r/',
    contrastDescription: 'Alveolar nasal vs. alveolar approximant',
    difficulty: 1, category: 'nasal_approximant',
  },
  {
    id: 'fish_dish',
    word1: 'fish', word2: 'dish',
    contrastType: 'initial',
    phoneme1: '/f/', phoneme2: '/d/',
    contrastDescription: 'Voiceless labiodental fricative vs. voiced alveolar stop',
    difficulty: 1, category: 'stop_fricative',
  },
  {
    id: 'star_jar',
    word1: 'star', word2: 'jar',
    contrastType: 'initial',
    phoneme1: '/st/', phoneme2: '/dʒ/',
    contrastDescription: '/s/+stop cluster vs. voiced postalveolar affricate',
    difficulty: 1, category: 'cluster_affricate',
  },
  {
    id: 'sock_lock',
    word1: 'sock', word2: 'lock',
    contrastType: 'initial',
    phoneme1: '/s/', phoneme2: '/l/',
    contrastDescription: 'Voiceless alveolar fricative vs. lateral approximant',
    difficulty: 1, category: 'fricative_approximant',
  },
  {
    id: 'mouse_house',
    word1: 'mouse', word2: 'house',
    contrastType: 'initial',
    phoneme1: '/m/', phoneme2: '/h/',
    contrastDescription: 'Bilabial nasal vs. voiceless glottal fricative',
    difficulty: 1, category: 'nasal_fricative',
  },
  {
    id: 'bee_tie',
    word1: 'bee', word2: 'tie',
    contrastType: 'initial',
    phoneme1: '/b/', phoneme2: '/t/',
    contrastDescription: 'Voiced bilabial stop vs. voiceless alveolar stop',
    difficulty: 1, category: 'place_voicing',
  },

  // ============================================================
  // Phase 4 top-up (May 2026) — photo-backed pairs to bring all
  // three playable tiers to the 20-item variety target.
  // Every word1/word2 below is verified present in PHOTO_BANK.
  // ============================================================

  // --- Tier 1 (distinct contrasts, clinical L1–L3) ---
  {
    id: 'frog_dog',
    word1: 'frog', word2: 'dog',
    contrastType: 'initial',
    phoneme1: '/f/', phoneme2: '/d/',
    contrastDescription: 'Voiceless labiodental fricative vs. voiced alveolar stop',
    difficulty: 1, category: 'stop_fricative',
  },
  {
    id: 'lock_sock',
    word1: 'lock', word2: 'sock',
    contrastType: 'initial',
    phoneme1: '/l/', phoneme2: '/s/',
    contrastDescription: 'Lateral liquid vs. voiceless alveolar fricative',
    difficulty: 1, category: 'liquid_fricative',
  },
  {
    id: 'car_jar',
    word1: 'car', word2: 'jar',
    contrastType: 'initial',
    phoneme1: '/k/', phoneme2: '/dʒ/',
    contrastDescription: 'Voiceless velar stop vs. voiced palato-alveolar affricate',
    difficulty: 1, category: 'stop_affricate',
  },
  {
    id: 'bell_yell',
    word1: 'bell', word2: 'yell',
    contrastType: 'initial',
    phoneme1: '/b/', phoneme2: '/j/',
    contrastDescription: 'Voiced bilabial stop vs. palatal glide',
    difficulty: 1, category: 'stop_glide',
  },

  // --- Tier 2 (single-feature contrasts, clinical L4–L7) ---
  {
    id: 'tooth_teeth',
    word1: 'tooth', word2: 'teeth',
    contrastType: 'medial',
    phoneme1: '/uː/', phoneme2: '/iː/',
    contrastDescription: 'High back vs. high front tense vowel — singular/plural pair',
    difficulty: 2, category: 'vowel_contrast',
  },
  {
    id: 'ham_hat',
    word1: 'ham', word2: 'hat',
    contrastType: 'final',
    phoneme1: '/m/', phoneme2: '/t/',
    contrastDescription: 'Bilabial nasal vs. voiceless alveolar stop (final position)',
    difficulty: 2, category: 'nasal_stop',
  },
  {
    id: 'chip_zip',
    word1: 'chip', word2: 'zip',
    contrastType: 'initial',
    phoneme1: '/tʃ/', phoneme2: '/z/',
    contrastDescription: 'Voiceless palato-alveolar affricate vs. voiced alveolar fricative',
    difficulty: 2, category: 'fricative_affricate',
  },

  // --- Tier 3 (close-feature contrasts, clinical L8 aspirational) ---
  {
    id: 'ham_hen',
    word1: 'ham', word2: 'hen',
    contrastType: 'medial',
    phoneme1: '/æ/', phoneme2: '/ɛ/',
    contrastDescription: 'Low front vs. mid front vowel — close vowel contrast',
    difficulty: 3, category: 'vowel_contrast',
  },
  {
    id: 'bin_bun',
    word1: 'bin', word2: 'bun',
    contrastType: 'medial',
    phoneme1: '/ɪ/', phoneme2: '/ʌ/',
    contrastDescription: 'High front lax vs. mid central vowel',
    difficulty: 3, category: 'vowel_contrast',
  },
  // NOTE: 'web_red' removed — red.jpg depicts a red apple, making "red" an
  // ambiguous stimulus (users name it "apple"). Drop until a true red swatch exists.

  {
    id: 'bell_bed',
    word1: 'bell', word2: 'bed',
    contrastType: 'final',
    phoneme1: '/l/', phoneme2: '/d/',
    contrastDescription: 'Lateral liquid vs. voiced alveolar stop (final position)',
    difficulty: 3, category: 'placement',
  },
  {
    id: 'net_jet',
    word1: 'net', word2: 'jet',
    contrastType: 'initial',
    phoneme1: '/n/', phoneme2: '/dʒ/',
    contrastDescription: 'Nasal vs. voiced affricate — manner-distant but confusable in noise',
    difficulty: 3, category: 'nasal_affricate',
  },
];

export interface MinimalPairTrial {
  pair: MinimalPair;
  trial1: PhotoTrial;
  trial2: PhotoTrial;
  targetIndex: 0 | 1; // Which word is the target (0 or 1)
  targetWord: string;
}

/**
 * Get photo trials for minimal pairs that have photos available
 */
export function getMinimalPairTrials(): MinimalPairTrial[] {
  const photoMap = new Map<string, PhotoTrial>();
  
  // Build lookup map of photos by target word
  for (const trial of PHOTO_BANK) {
    photoMap.set(trial.target.toLowerCase(), trial);
  }
  
  const validPairs: MinimalPairTrial[] = [];
  
  for (const pair of MINIMAL_PAIRS) {
    const trial1 = photoMap.get(pair.word1.toLowerCase());
    const trial2 = photoMap.get(pair.word2.toLowerCase());
    
    // Only include pairs where both words have photos
    if (trial1 && trial2) {
      // Randomly select which word is the target
      const targetIndex = Math.random() < 0.5 ? 0 : 1;
      validPairs.push({
        pair,
        trial1,
        trial2,
        targetIndex: targetIndex as 0 | 1,
        targetWord: targetIndex === 0 ? pair.word1 : pair.word2,
      });
    }
  }
  
  return validPairs;
}

// ─── Phase 1.5 Adaptive Standard ───────────────────────────────────────────
// Strict 3-tier mapping for phonological discrimination.
// Engine level (1-10) → tier (1|2|3). No ±tolerance, no blending.
// Aligned to the canonical Phase 1.5 split (≤3 / 4-7 / ≥8) shared by
// PhotoNaming, MultiStepPlanning, and DetectiveMind.

export type MinimalPairsTier = 1 | 2 | 3;

export const mapEngineLevelToMinimalPairsTier = (level: number): MinimalPairsTier => {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
};

/** Position hardness: initial < medial < final (final = hardest acoustically). */
function contrastPositionRank(t: MinimalPairTrial): number {
  switch (t.pair.contrastType) {
    case 'initial': return 0;
    case 'medial': return 1;
    case 'final': return 2;
    default: return 1;
  }
}

/**
 * MinimalPairs intensity hardness key — sort within a tier cohort by:
 *   contrastPosition (initial<medial<final) → alphabetical (stable secondary)
 */
function minimalPairHardness(t: MinimalPairTrial): number {
  return contrastPositionRank(t) * 1000 + t.pair.id.charCodeAt(0);
}

/**
 * Get minimal pair trials for the engine level.
 *
 * Behavior change (May 2026): reads the per-game intensity ladder
 * (`src/lib/intensity/minimalPairsIntensity.ts`) to slice each level's
 * cohort by sub-tier index. Levels 4..7 share Tier 2 but slide from easy
 * (initial-position contrasts) → hard (final-position contrasts).
 *
 * Falls back to the legacy strict-tier selector when the intensity registry
 * has no entry (defensive — registry is eagerly loaded).
 */
export function getMinimalPairTrialsForLevel(
  level: number,
  count: number = 10,
  options?: { focusPhonemes?: string[] }
): MinimalPairTrial[] {
  const allTrials = getMinimalPairTrials();
  const targetTier = mapEngineLevelToMinimalPairsTier(level);

  const spec = getLevelContent('minimal-pairs', level);

  // Cohort key maps directly to pair.difficulty (1..3).
  const cohortTier = (cohort: string): 1 | 2 | 3 => {
    if (cohort === 'tier_1') return 1;
    if (cohort === 'tier_3') return 3;
    return 2;
  };

  let filtered: MinimalPairTrial[];
  if (spec) {
    const tier = cohortTier(spec.cohort);
    const cohortPool = allTrials.filter(t => t.pair.difficulty === tier);
    if (cohortPool.length === 0) {
      console.warn(`⚠️ MinimalPairs: no photo-backed pairs at tier ${tier}`);
      return [];
    }
    filtered = sliceCohortByIntensity(
      cohortPool,
      minimalPairHardness,
      spec.subTierIndex,
      Math.max(count * 2, 6)
    );
  } else {
    filtered = allTrials.filter(t => t.pair.difficulty === targetTier);
    if (filtered.length === 0) {
      console.warn(`⚠️ MinimalPairs: no photo-backed pairs at tier ${targetTier}`);
      return [];
    }
  }

  // Phoneme-focus prioritization (within slice).
  const focusPhonemes = options?.focusPhonemes;
  if (focusPhonemes && focusPhonemes.length > 0) {
    const focusSet = new Set(focusPhonemes.map(p => p.toLowerCase().replace(/\//g, '')));
    const matchesFocus = (trial: MinimalPairTrial) => {
      const p1 = trial.pair.phoneme1.toLowerCase().replace(/\//g, '');
      const p2 = trial.pair.phoneme2.toLowerCase().replace(/\//g, '');
      return focusSet.has(p1) || focusSet.has(p2);
    };
    const prioritized = filtered.filter(matchesFocus);
    const others = filtered.filter(t => !matchesFocus(t));
    const merged = [...prioritized, ...others];
    if (merged.length >= count) return merged.slice(0, count);
    const out: MinimalPairTrial[] = [];
    while (out.length < count) out.push(merged[out.length % merged.length]);
    return out;
  }

  // No focus phonemes: preserve intensity-sliced order; tiny tie-break shuffle.
  if (filtered.length >= count) return filtered.slice(0, count);
  const out: MinimalPairTrial[] = [];
  while (out.length < count) out.push(filtered[out.length % filtered.length]);
  return out;
}

/**
 * Get pairs for a specific contrast category
 */
export function getMinimalPairsByCategory(category: string): MinimalPairTrial[] {
  const allTrials = getMinimalPairTrials();
  return allTrials.filter(t => t.pair.category === category);
}

/**
 * Get stats about available minimal pairs
 */
export function getMinimalPairStats() {
  const allTrials = getMinimalPairTrials();
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<number, number> = {};
  
  for (const trial of allTrials) {
    byCategory[trial.pair.category] = (byCategory[trial.pair.category] || 0) + 1;
    byDifficulty[trial.pair.difficulty] = (byDifficulty[trial.pair.difficulty] || 0) + 1;
  }
  
  return {
    total: allTrials.length,
    definedPairs: MINIMAL_PAIRS.length,
    byCategory,
    byDifficulty,
    missingPhotos: MINIMAL_PAIRS.filter(p => {
      const trials = getMinimalPairTrials();
      return !trials.some(t => t.pair.id === p.id);
    }).map(p => [p.word1, p.word2]),
  };
}
