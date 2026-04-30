// Functional phrases for speech rehabilitation
// Focused on daily communication needs (script training & MIT-inspired)

import { normalizeASROutput, extractContentWords } from '@/lib/speechNormalizer';

export interface PhraseFeatures {
  syllable_count: number;
  word_count: number;
  contains_pronouns: boolean;
  motor_complexity: 'simple' | 'moderate' | 'complex';
  frequency_rank: number; // 1-10000 (lower = more common)
  emotional_valence: 'neutral' | 'positive' | 'negative';
  social_context: 'caregiver' | 'medical' | 'self_care' | 'social' | 'emergency';
}

export interface PhraseTrial {
  id: string;
  phrase: string;
  category: 'daily_needs' | 'social' | 'medical' | 'emotional';
  difficulty: number; // 1-5
  imageUrl?: string; // Optional visual support
  features: PhraseFeatures;
  semanticAlternatives?: string[]; // Related phrases
  cueWords?: string[]; // Key words for semantic cueing
}

export const PHRASE_BANK: PhraseTrial[] = [
  // LEVEL 1: Simple daily needs (2-3 words, high frequency, simple motor)
  {
    id: 'need_help',
    phrase: "I need help",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 50,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['help', 'need'],
    semanticAlternatives: ["Help me", "I need assistance"]
  },
  {
    id: 'im_thirsty',
    phrase: "I'm thirsty",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 200,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['thirsty', 'water'],
    semanticAlternatives: ["I want water", "Water please"]
  },
  {
    id: 'im_tired',
    phrase: "I'm tired",
    category: 'emotional',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 150,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['tired', 'rest'],
    semanticAlternatives: ["I need rest", "I'm exhausted"]
  },
  {
    id: 'thank_you',
    phrase: "Thank you",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 2,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 20,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['thank', 'thanks'],
    semanticAlternatives: ["Thanks", "Thanks so much"]
  },
  {
    id: 'im_hungry',
    phrase: "I'm hungry",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 180,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['hungry', 'food'],
    semanticAlternatives: ["I want food", "I need to eat"]
  },
  {
    id: 'yes_please',
    phrase: "Yes please",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 2,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 30,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['yes', 'please'],
    semanticAlternatives: ["Yes", "Okay"]
  },
  {
    id: 'no_thanks',
    phrase: "No thanks",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 2,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 40,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['no', 'thanks'],
    semanticAlternatives: ["No thank you", "I'm good"]
  },
  {
    id: 'im_cold',
    phrase: "I'm cold",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 160,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['cold', 'blanket'],
    semanticAlternatives: ["I need a blanket", "It's cold"]
  },
  {
    id: 'im_hot',
    phrase: "I'm hot",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 170,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['hot', 'warm'],
    semanticAlternatives: ["Too warm", "I'm warm"]
  },
  {
    id: 'im_okay',
    phrase: "I'm okay",
    category: 'emotional',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 80,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['okay', 'fine'],
    semanticAlternatives: ["I'm fine", "I'm good"]
  },
  {
    id: 'hello',
    phrase: "Hello",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 1,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 10,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['hello', 'hi'],
    semanticAlternatives: ["Hi", "Hey"]
  },
  {
    id: 'goodbye',
    phrase: "Goodbye",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 1,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 60,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['bye', 'later'],
    semanticAlternatives: ["Bye", "See you"]
  },
  {
    id: 'yes',
    phrase: "Yes",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 1,
      word_count: 1,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 5,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['yes', 'yeah'],
    semanticAlternatives: ["Yeah", "Yep"]
  },
  {
    id: 'no',
    phrase: "No",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 1,
      word_count: 1,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 6,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['no', 'nope'],
    semanticAlternatives: ["Nope"]
  },
  {
    id: 'please',
    phrase: "Please",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 1,
      word_count: 1,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 25,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['please'],
    semanticAlternatives: ["Please?"]
  },

  // LEVEL 2: Common requests (3-4 words, moderate frequency)
  {
    id: 'need_bathroom',
    phrase: "I need the bathroom",
    category: 'daily_needs',
    difficulty: 2,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 300,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['bathroom', 'need'],
    semanticAlternatives: ["I need to go", "Bathroom please"]
  },
  {
    id: 'in_pain',
    phrase: "I'm in pain",
    category: 'medical',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 250,
      emotional_valence: 'negative',
      social_context: 'medical'
    },
    cueWords: ['pain', 'hurt'],
    semanticAlternatives: ["It hurts", "I hurt"]
  },
  {
    id: 'good_morning',
    phrase: "Good morning",
    category: 'social',
    difficulty: 2,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 100,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['morning', 'hello'],
    semanticAlternatives: ["Hello", "Hi there"]
  },
  {
    id: 'need_medicine',
    phrase: "I need my medicine",
    category: 'medical',
    difficulty: 2,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 400,
      emotional_valence: 'neutral',
      social_context: 'medical'
    },
    cueWords: ['medicine', 'pills'],
    semanticAlternatives: ["I need pills", "Time for medicine"]
  },
  {
    id: 'feel_better',
    phrase: "I feel better",
    category: 'emotional',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 200,
      emotional_valence: 'positive',
      social_context: 'caregiver'
    },
    cueWords: ['better', 'feel'],
    semanticAlternatives: ["I'm better", "Feeling good"]
  },
  {
    id: 'more_water',
    phrase: "More water please",
    category: 'daily_needs',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 220,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['water', 'more'],
    semanticAlternatives: ["I want water", "Water please"]
  },
  {
    id: 'im_sorry',
    phrase: "I'm sorry",
    category: 'social',
    difficulty: 2,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 90,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['sorry', 'apologize'],
    semanticAlternatives: ["Sorry", "My apologies"]
  },
  {
    id: 'how_are_you',
    phrase: "How are you",
    category: 'social',
    difficulty: 2,
    features: {
      syllable_count: 3,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 50,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['how', 'you'],
    semanticAlternatives: ["How's it going", "How do you feel"]
  },
  {
    id: 'see_you_later',
    phrase: "See you later",
    category: 'social',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 120,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['see', 'later'],
    semanticAlternatives: ["Goodbye", "Bye for now"]
  },
  {
    id: 'im_frustrated',
    phrase: "I'm frustrated",
    category: 'emotional',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 450,
      emotional_valence: 'negative',
      social_context: 'caregiver'
    },
    cueWords: ['frustrated', 'upset'],
    semanticAlternatives: ["I'm upset", "This is hard"]
  },
  {
    id: 'need_rest',
    phrase: "I need to rest",
    category: 'daily_needs',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 280,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['rest', 'tired'],
    semanticAlternatives: ["I'm tired", "Need a break"]
  },

  // LEVEL 3: Longer functional phrases (4-5 words)
  {
    id: 'call_doctor',
    phrase: "Please call the doctor",
    category: 'medical',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 500,
      emotional_valence: 'neutral',
      social_context: 'emergency'
    },
    cueWords: ['doctor', 'call'],
    semanticAlternatives: ["Call my doctor", "I need the doctor"]
  },
  {
    id: 'want_sit_down',
    phrase: "I want to sit down",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 350,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['sit', 'down'],
    semanticAlternatives: ["Let me sit", "Need to sit"]
  },
  {
    id: 'whats_time',
    phrase: "What time is it",
    category: 'social',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 300,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['time', 'what'],
    semanticAlternatives: ["What's the time", "Tell me the time"]
  },
  {
    id: 'turn_tv',
    phrase: "Turn on the TV",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 450,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['TV', 'turn'],
    semanticAlternatives: ["TV on please", "I want TV"]
  },
  {
    id: 'need_blanket',
    phrase: "I need a blanket",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 600,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['blanket', 'cold'],
    semanticAlternatives: ["I'm cold", "Blanket please"]
  },
  {
    id: 'wheres_phone',
    phrase: "Where is my phone",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 380,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['phone', 'where'],
    semanticAlternatives: ["Find my phone", "I need my phone"]
  },
  {
    id: 'open_window',
    phrase: "Open the window please",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 520,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['window', 'open'],
    semanticAlternatives: ["I need air", "Window please"]
  },
  {
    id: 'close_door',
    phrase: "Close the door please",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 480,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['door', 'close'],
    semanticAlternatives: ["Shut the door", "Door please"]
  },
  {
    id: 'turn_off_light',
    phrase: "Turn off the light",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 440,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['light', 'off'],
    semanticAlternatives: ["Light off please", "Too bright"]
  },
  {
    id: 'need_glasses',
    phrase: "I need my glasses",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 550,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['glasses', 'see'],
    semanticAlternatives: ["Where are my glasses", "Can't see"]
  },
  {
    id: 'what_day_is_it',
    phrase: "What day is it",
    category: 'social',
    difficulty: 3,
    features: {
      syllable_count: 4,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 320,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['day', 'what'],
    semanticAlternatives: ["What's the day", "Today is"]
  },

  // LEVEL 4: Complex functional phrases (5-6 words, harder motor planning)
  {
    id: 'help_stand_up',
    phrase: "Can you help me stand up",
    category: 'daily_needs',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 700,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['help', 'stand'],
    semanticAlternatives: ["Help me up", "I need to stand"]
  },
  {
    id: 'feeling_dizzy',
    phrase: "I'm feeling very dizzy",
    category: 'medical',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 800,
      emotional_valence: 'negative',
      social_context: 'emergency'
    },
    cueWords: ['dizzy', 'feeling'],
    semanticAlternatives: ["I feel dizzy", "Very dizzy"]
  },
  {
    id: 'talk_family',
    phrase: "I want to talk to my family",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 600,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['family', 'talk'],
    semanticAlternatives: ["Call my family", "Family please"]
  },
  {
    id: 'dont_understand',
    phrase: "I don't understand what you said",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 500,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['understand', "don't"],
    semanticAlternatives: ["I'm confused", "Say that again"]
  },
  {
    id: 'thanks_help',
    phrase: "Thank you for helping me",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 400,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['thank', 'help'],
    semanticAlternatives: ["Thanks for the help", "Appreciate it"]
  },
  {
    id: 'speak_slower',
    phrase: "Can you speak slower please",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 650,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['slower', 'speak'],
    semanticAlternatives: ["Slow down please", "Too fast"]
  },
  {
    id: 'repeat_please',
    phrase: "Can you repeat that please",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 580,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['repeat', 'again'],
    semanticAlternatives: ["Say that again", "What did you say"]
  },
  {
    id: 'need_more_time',
    phrase: "I need a little more time",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 8,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 620,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['time', 'need'],
    semanticAlternatives: ["Wait please", "Give me a moment"]
  },
  {
    id: 'feel_nauseous',
    phrase: "I'm feeling a little nauseous",
    category: 'medical',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 900,
      emotional_valence: 'negative',
      social_context: 'medical'
    },
    cueWords: ['nauseous', 'sick'],
    semanticAlternatives: ["I feel sick", "Stomach upset"]
  },
  {
    id: 'want_go_outside',
    phrase: "I want to go outside",
    category: 'daily_needs',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 550,
      emotional_valence: 'positive',
      social_context: 'caregiver'
    },
    cueWords: ['outside', 'go'],
    semanticAlternatives: ["Take me outside", "Fresh air please"]
  },
  {
    id: 'water_glass',
    phrase: "Could I have a glass of water",
    category: 'daily_needs',
    difficulty: 4,
    features: {
      syllable_count: 8,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 480,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['water', 'glass'],
    semanticAlternatives: ["Can I get some water", "I would like water"]
  },
  {
    id: 'too_loud_here',
    phrase: "It is too loud in here",
    category: 'daily_needs',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 6,
      contains_pronouns: false,
      motor_complexity: 'complex',
      frequency_rank: 600,
      emotional_valence: 'negative',
      social_context: 'caregiver'
    },
    cueWords: ['loud', 'noisy'],
    semanticAlternatives: ["It's too noisy", "Can we lower the volume"]
  },
  {
    id: 'remind_pills',
    phrase: "Please remind me to take my pills",
    category: 'medical',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 720,
      emotional_valence: 'neutral',
      social_context: 'medical'
    },
    cueWords: ['remind', 'pills'],
    semanticAlternatives: ["Don't forget my medication", "Help me remember my meds"]
  },
  {
    id: 'right_word_struggle',
    phrase: "I am trying to find the right word",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 8,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 800,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['trying', 'word'],
    semanticAlternatives: ["I'm searching for the word", "Give me a moment for the word"]
  },

  // LEVEL 5: Complex social/emotional phrases (harder motor planning, abstract concepts)
  {
    id: 'worried_about',
    phrase: "I'm worried about my recovery",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 9,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 900,
      emotional_valence: 'negative',
      social_context: 'medical'
    },
    cueWords: ['worried', 'recovery'],
    semanticAlternatives: ["I'm anxious", "Concerned about progress"]
  },
  {
    id: 'proud_progress',
    phrase: "I'm proud of my progress today",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 8,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 850,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['proud', 'progress'],
    semanticAlternatives: ["Feeling good today", "Making progress"]
  },
  {
    id: 'need_talk',
    phrase: "I need to talk about something important",
    category: 'social',
    difficulty: 5,
    features: {
      syllable_count: 11,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 950,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['talk', 'important'],
    semanticAlternatives: ["Need to discuss", "Important conversation"]
  },
  {
    id: 'hard_find_words',
    phrase: "It's hard to find the right words",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 8,
      word_count: 7,
      contains_pronouns: false,
      motor_complexity: 'complex',
      frequency_rank: 1000,
      emotional_valence: 'negative',
      social_context: 'social'
    },
    cueWords: ['words', 'hard'],
    semanticAlternatives: ["Hard to speak", "Can't find words"]
  },
  {
    id: 'appreciate_patience',
    phrase: "I appreciate your patience with me",
    category: 'social',
    difficulty: 5,
    features: {
      syllable_count: 10,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 880,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['patience', 'appreciate'],
    semanticAlternatives: ["Thank you for waiting", "Thanks for understanding"]
  },
  {
    id: 'getting_better_everyday',
    phrase: "I'm getting better every day",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 8,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 750,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['better', 'day'],
    semanticAlternatives: ["Improving daily", "Making progress"]
  },
  {
    id: 'want_do_myself',
    phrase: "I want to try doing it myself",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 9,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 820,
      emotional_valence: 'positive',
      social_context: 'caregiver'
    },
    cueWords: ['myself', 'try'],
    semanticAlternatives: ["Let me try", "I can do it"]
  },
  {
    id: 'miss_way_things',
    phrase: "I miss the way things used to be",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 9,
      word_count: 8,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 920,
      emotional_valence: 'negative',
      social_context: 'social'
    },
    cueWords: ['miss', 'before'],
    semanticAlternatives: ["Things were different", "I miss before"]
  },
  {
    id: 'proud_myself_today',
    phrase: "I'm proud of myself for trying today",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 10,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 870,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['proud', 'trying'],
    semanticAlternatives: ["I did well", "Good effort today"]
  },
  {
    id: 'explain_doctor_clearly',
    phrase: "I want to explain things clearly to my doctor",
    category: 'medical',
    difficulty: 5,
    features: {
      syllable_count: 12,
      word_count: 9,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 920,
      emotional_valence: 'neutral',
      social_context: 'medical'
    },
    cueWords: ['explain', 'doctor'],
    semanticAlternatives: ["I want the doctor to understand me", "I'd like to be clear with the doctor"]
  },
  {
    id: 'frustrated_but_not_giving_up',
    phrase: "I am frustrated but I am not giving up",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 11,
      word_count: 9,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 890,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['frustrated', 'giving up'],
    semanticAlternatives: ["This is hard but I will keep going", "I'm frustrated but still trying"]
  },
  {
    id: 'remember_when_we_used',
    phrase: "I remember when we used to do this together",
    category: 'social',
    difficulty: 5,
    features: {
      syllable_count: 12,
      word_count: 9,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 950,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['remember', 'together'],
    semanticAlternatives: ["I miss our routine", "This used to be our thing"]
  },
  {
    id: 'celebrate_small_progress',
    phrase: "It feels good to celebrate the small wins",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 11,
      word_count: 8,
      contains_pronouns: false,
      motor_complexity: 'complex',
      frequency_rank: 900,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['celebrate', 'wins'],
    semanticAlternatives: ["The small victories matter", "Every bit of progress counts"]
  },
  {
    id: 'keep_going_one_step',
    phrase: "I am going to take this one step at a time",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 12,
      word_count: 11,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 880,
      emotional_valence: 'positive',
      social_context: 'self_care'
    },
    cueWords: ['step', 'time'],
    semanticAlternatives: ["I'll take it slow", "One step at a time"]
  },
];

/**
 * Map an engine difficulty (1..10) to the PhrasePractice content tier (1..5).
 *
 * The phrase bank is organized in 5 motor-/length-graded tiers. The engine emits
 * 1..10, so we collapse pairs of engine levels onto each tier. This is the SAME
 * contract used by FixSentence/DescribeGuess: callers pass an engine level, the
 * selector centralizes the tier mapping. NEVER use a ±1 cumulative band — that
 * causes silent tier blending and breaks perceptual progression.
 */
export function mapEngineLevelToPhraseTier(engineLevel: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(engineLevel)) return 1;
  const lvl = Math.max(1, Math.min(10, Math.round(engineLevel)));
  if (lvl <= 2) return 1;       // engine 1-2  → tier 1 (warm-up: 1-3 word automatic phrases)
  if (lvl <= 4) return 2;       // engine 3-4  → tier 2 (short functional phrases)
  if (lvl <= 6) return 3;       // engine 5-6  → tier 3 (4-word commands/questions)
  if (lvl <= 8) return 4;       // engine 7-8  → tier 4 (5-7 word complex phrases)
  return 5;                     // engine 9-10 → tier 5 (multi-clause, expressive)
}

// Get phrases for a specific TIER (1..5). Pure helper for tests/dev tools.
export function getPhrasesForLevel(level: number, count: number = 10): PhraseTrial[] {
  const tier = Math.max(1, Math.min(5, Math.round(level)));
  const levelPhrases = PHRASE_BANK.filter(p => p.difficulty === tier);
  const shuffled = [...levelPhrases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Selector used by PhrasePracticeGame.
 *
 * Accepts an ENGINE level (1..10) and returns trials drawn EXCLUSIVELY from the
 * mapped tier. No cumulative ±1 band, no tier blending. If the tier pool is
 * smaller than the requested count we cycle within the tier (never fall back
 * to other tiers) so perceptual difficulty is preserved.
 */
export function getTrialsForLevel(engineLevel: number, totalTrials: number): PhraseTrial[] {
  const requested = Math.max(0, totalTrials);
  if (requested === 0 || PHRASE_BANK.length === 0) return [];

  const tier = mapEngineLevelToPhraseTier(engineLevel);
  const pool = PHRASE_BANK.filter(p => p.difficulty === tier);

  // Defensive: if a tier is empty (shouldn't happen — guarded by tests),
  // fall back to the nearest populated tier rather than the whole bank.
  let sourcePool = pool;
  if (sourcePool.length === 0) {
    for (let delta = 1; delta <= 4 && sourcePool.length === 0; delta++) {
      sourcePool = PHRASE_BANK.filter(
        p => p.difficulty === tier - delta || p.difficulty === tier + delta,
      );
    }
    if (sourcePool.length === 0) sourcePool = PHRASE_BANK;
  }

  const selected: PhraseTrial[] = [];
  while (selected.length < requested) {
    const shuffled = [...sourcePool].sort(() => Math.random() - 0.5);
    selected.push(...shuffled);
  }
  return selected.slice(0, requested);
}

// Generate semantic alternatives (no multiple choice for phrases, but useful for partial credit)
export function getPhraseAlternatives(phrase: PhraseTrial): string[] {
  return phrase.semanticAlternatives || [phrase.phrase];
}

// Check if spoken phrase matches target (MORE FORGIVING for aphasia)
export function evaluatePhraseMatch(spoken: string, target: PhraseTrial): {
  match: boolean;
  wordAccuracy: number;
  matchedWords: string[];
} {
  // Clean up fillers FIRST
  const cleanedSpoken = normalizeASROutput(spoken);
  const spokenWords = cleanedSpoken.toLowerCase().trim().split(/\s+/);
  const targetWords = target.phrase.toLowerCase().split(/\s+/);
  
  // Extract content words for partial credit
  const contentWords = extractContentWords(target.phrase);
  
  let matchedCount = 0;
  const matched: string[] = [];
  
  for (const targetWord of targetWords) {
    // Check if any spoken word closely matches this target word
    const found = spokenWords.some(sw => {
      const similarity = getWordSimilarity(sw, targetWord);
      return similarity > 0.65; // More forgiving (was 0.7)
    });
    
    if (found) {
      matchedCount++;
      matched.push(targetWord);
    }
  }
  
  const wordAccuracy = targetWords.length > 0 ? matchedCount / targetWords.length : 0;
  
  // Consider it a match if 65%+ of words are correct (was 80%)
  // Give partial credit for getting key content words
  const matchThreshold = contentWords.length > 0 && matched.some(w => contentWords.includes(w))
    ? 0.6  // Lower threshold if they got at least one content word
    : 0.65; // Standard threshold
  
  return {
    match: wordAccuracy >= matchThreshold,
    wordAccuracy,
    matchedWords: matched
  };
}

// Simple word similarity using Levenshtein-like approach
function getWordSimilarity(word1: string, word2: string): number {
  const longer = word1.length > word2.length ? word1 : word2;
  const shorter = word1.length > word2.length ? word2 : word1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
