/**
 * Voice Practice Mode — Game definitions for audio-only therapy
 * 
 * Each game can run entirely through voice (no visuals required).
 * Maya speaks prompts, user responds verbally, system scores.
 */

export type VoiceGameType = 
  | 'story_retell'
  | 'category_fluency'
  | 'sentence_expansion'
  | 'synonym_swap'
  | 'opposites'
  | 'fill_blank'
  | 'describe_without_naming'
  | 'yes_no_why';

export interface VoiceGameDef {
  type: VoiceGameType;
  label: string;
  /** Maya's intro line when starting this game */
  intro: string;
  /** Approximate duration in seconds */
  durationSec: number;
  /** Clinical domain */
  domain: string;
}

export const VOICE_GAMES: VoiceGameDef[] = [
  {
    type: 'story_retell',
    label: 'Story Retell',
    intro: "I'll tell you a short story, then you tell it back to me.",
    durationSec: 60,
    domain: 'discourse',
  },
  {
    type: 'category_fluency',
    label: 'Category Naming',
    intro: "Let's see how many you can name. Ready?",
    durationSec: 30,
    domain: 'lexical_retrieval',
  },
  {
    type: 'sentence_expansion',
    label: 'Build a Sentence',
    intro: "I'll say a short sentence. You repeat it, then make it longer.",
    durationSec: 40,
    domain: 'syntax',
  },
  {
    type: 'synonym_swap',
    label: 'Word Swap',
    intro: "I'll say a word. You tell me another word that means the same thing.",
    durationSec: 30,
    domain: 'semantic_depth',
  },
  {
    type: 'opposites',
    label: 'Opposites',
    intro: "I say a word, you say the opposite. Let's go!",
    durationSec: 25,
    domain: 'semantic_depth',
  },
  {
    type: 'fill_blank',
    label: 'Finish the Sentence',
    intro: "I'll start a sentence, and you finish it.",
    durationSec: 30,
    domain: 'syntax',
  },
  {
    type: 'describe_without_naming',
    label: 'Describe It',
    intro: "Describe something for me without saying its name. I'll try to guess!",
    durationSec: 40,
    domain: 'semantic_depth',
  },
  {
    type: 'yes_no_why',
    label: 'Tell Me Why',
    intro: "I'll ask you a question. Answer yes or no, then tell me why.",
    durationSec: 30,
    domain: 'discourse',
  },
];

// ─── Game Stimuli ───

export interface CategoryPrompt {
  category: string;
  examples: string[];  // for scoring
  difficulty: 1 | 2 | 3;
}

export const CATEGORY_PROMPTS: CategoryPrompt[] = [
  { category: 'animals', examples: ['dog','cat','bird','fish','horse','cow','pig','rabbit','mouse','lion','tiger','bear','elephant','monkey','snake','chicken','duck','sheep','goat','deer'], difficulty: 1 },
  { category: 'fruits', examples: ['apple','banana','orange','grape','strawberry','blueberry','pear','peach','mango','watermelon','cherry','lemon','lime','pineapple','kiwi'], difficulty: 1 },
  { category: 'things in a kitchen', examples: ['stove','oven','fridge','sink','cup','plate','bowl','fork','knife','spoon','pan','pot','microwave','toaster','table','chair','glass','mug'], difficulty: 1 },
  { category: 'clothing', examples: ['shirt','pants','shoes','socks','hat','jacket','coat','dress','skirt','sweater','scarf','gloves','boots','belt','tie','shorts'], difficulty: 1 },
  { category: 'things at a grocery store', examples: ['bread','milk','eggs','cheese','butter','cereal','rice','pasta','chicken','beef','tomato','lettuce','apple','banana','juice','water','soap','paper'], difficulty: 2 },
  { category: 'things that are red', examples: ['apple','tomato','fire','blood','rose','cherry','strawberry','stop sign','ladybug','heart','cardinal','brick','pepper'], difficulty: 2 },
  { category: 'things you do in the morning', examples: ['wake up','brush teeth','shower','get dressed','eat breakfast','drink coffee','make bed','check phone','stretch','exercise','wash face'], difficulty: 2 },
  { category: 'jobs or occupations', examples: ['doctor','teacher','nurse','firefighter','police','chef','driver','pilot','lawyer','dentist','farmer','builder','artist','writer','singer'], difficulty: 3 },
  { category: 'things at a hospital', examples: ['bed','doctor','nurse','medicine','needle','bandage','wheelchair','ambulance','x-ray','stethoscope','chart','mask','gloves','waiting room'], difficulty: 3 },
];

export interface SentenceExpansionPrompt {
  starter: string;
  expansionHints: string[];
  difficulty: 1 | 2 | 3;
}

export const SENTENCE_EXPANSION_PROMPTS: SentenceExpansionPrompt[] = [
  { starter: 'I went outside', expansionHints: ['Where did you go?', 'What did you see?', 'Who was with you?'], difficulty: 1 },
  { starter: 'I ate breakfast', expansionHints: ['What did you eat?', 'Where did you eat?', 'How did it taste?'], difficulty: 1 },
  { starter: 'I saw a dog', expansionHints: ['What color was it?', 'What was it doing?', 'Where was it?'], difficulty: 1 },
  { starter: 'She went to the store', expansionHints: ['Which store?', 'What did she buy?', 'Why did she go?'], difficulty: 2 },
  { starter: 'The man was happy', expansionHints: ['Why was he happy?', 'What did he do?', 'Who was he with?'], difficulty: 2 },
  { starter: 'It started raining', expansionHints: ['What happened next?', 'Where were you?', 'What did you do?'], difficulty: 2 },
  { starter: 'They drove to the beach', expansionHints: ['How long did it take?', 'What did they bring?', 'What did they do there?'], difficulty: 3 },
];

export interface SynonymPrompt {
  word: string;
  synonyms: string[];
  difficulty: 1 | 2 | 3;
}

export const SYNONYM_PROMPTS: SynonymPrompt[] = [
  { word: 'big', synonyms: ['large','huge','enormous','giant','massive'], difficulty: 1 },
  { word: 'happy', synonyms: ['glad','joyful','cheerful','pleased','delighted'], difficulty: 1 },
  { word: 'fast', synonyms: ['quick','speedy','rapid','swift'], difficulty: 1 },
  { word: 'sad', synonyms: ['unhappy','upset','miserable','gloomy','down'], difficulty: 1 },
  { word: 'cold', synonyms: ['chilly','freezing','cool','icy','frigid'], difficulty: 1 },
  { word: 'smart', synonyms: ['clever','intelligent','bright','wise','sharp'], difficulty: 2 },
  { word: 'angry', synonyms: ['mad','furious','upset','irritated','annoyed'], difficulty: 2 },
  { word: 'beautiful', synonyms: ['pretty','gorgeous','lovely','stunning','attractive'], difficulty: 2 },
  { word: 'scary', synonyms: ['frightening','terrifying','creepy','spooky','alarming'], difficulty: 2 },
  { word: 'start', synonyms: ['begin','commence','launch','initiate','kick off'], difficulty: 3 },
  { word: 'important', synonyms: ['significant','crucial','vital','essential','key'], difficulty: 3 },
];

export interface OppositePrompt {
  word: string;
  opposite: string;
  difficulty: 1 | 2 | 3;
}

export const OPPOSITE_PROMPTS: OppositePrompt[] = [
  { word: 'hot', opposite: 'cold', difficulty: 1 },
  { word: 'big', opposite: 'small', difficulty: 1 },
  { word: 'fast', opposite: 'slow', difficulty: 1 },
  { word: 'up', opposite: 'down', difficulty: 1 },
  { word: 'happy', opposite: 'sad', difficulty: 1 },
  { word: 'old', opposite: 'young', difficulty: 1 },
  { word: 'light', opposite: 'dark', difficulty: 1 },
  { word: 'open', opposite: 'closed', difficulty: 1 },
  { word: 'hard', opposite: 'soft', difficulty: 2 },
  { word: 'loud', opposite: 'quiet', difficulty: 2 },
  { word: 'early', opposite: 'late', difficulty: 2 },
  { word: 'shallow', opposite: 'deep', difficulty: 2 },
  { word: 'brave', opposite: 'cowardly', difficulty: 3 },
  { word: 'generous', opposite: 'selfish', difficulty: 3 },
  { word: 'temporary', opposite: 'permanent', difficulty: 3 },
];

export interface FillBlankPrompt {
  sentence: string;
  answer: string[];
  difficulty: 1 | 2 | 3;
}

export const FILL_BLANK_PROMPTS: FillBlankPrompt[] = [
  { sentence: 'I drink coffee in the ____', answer: ['morning'], difficulty: 1 },
  { sentence: 'You sleep in a ____', answer: ['bed'], difficulty: 1 },
  { sentence: 'The sun comes up in the ____', answer: ['morning','east'], difficulty: 1 },
  { sentence: 'You wash your hands with soap and ____', answer: ['water'], difficulty: 1 },
  { sentence: 'A doctor works at a ____', answer: ['hospital','clinic','office'], difficulty: 1 },
  { sentence: 'You cut food with a ____', answer: ['knife'], difficulty: 2 },
  { sentence: 'When it rains you need an ____', answer: ['umbrella'], difficulty: 2 },
  { sentence: 'Books are kept in a ____', answer: ['library','shelf','bookcase','bookshelf'], difficulty: 2 },
  { sentence: 'The opposite of love is ____', answer: ['hate','hatred'], difficulty: 3 },
  { sentence: 'A group of fish is called a ____', answer: ['school','shoal'], difficulty: 3 },
];

export interface DescribePrompt {
  word: string;
  hints: string[];
  difficulty: 1 | 2 | 3;
}

export const DESCRIBE_PROMPTS: DescribePrompt[] = [
  { word: 'car', hints: ['you drive it', 'has four wheels', 'you travel in it'], difficulty: 1 },
  { word: 'dog', hints: ['an animal', 'it barks', 'a pet'], difficulty: 1 },
  { word: 'phone', hints: ['you call people', 'has a screen', 'you hold it'], difficulty: 1 },
  { word: 'umbrella', hints: ['protects from rain', 'you open it', 'you hold it above your head'], difficulty: 2 },
  { word: 'refrigerator', hints: ['keeps food cold', 'in the kitchen', 'has a door'], difficulty: 2 },
  { word: 'dentist', hints: ['a person', 'checks your teeth', 'you sit in a chair'], difficulty: 3 },
  { word: 'library', hints: ['a building', 'has many books', 'you must be quiet'], difficulty: 3 },
];

export interface YesNoPrompt {
  question: string;
  difficulty: 1 | 2 | 3;
}

export const YES_NO_PROMPTS: YesNoPrompt[] = [
  { question: 'Do you like coffee?', difficulty: 1 },
  { question: 'Is it good to exercise?', difficulty: 1 },
  { question: 'Do you enjoy music?', difficulty: 1 },
  { question: 'Do you think dogs are better than cats?', difficulty: 2 },
  { question: 'Would you rather live by the beach or in the mountains?', difficulty: 2 },
  { question: 'Is it important to eat breakfast every day?', difficulty: 2 },
  { question: 'Do you think people should work from home?', difficulty: 3 },
  { question: 'Is technology making life better or worse?', difficulty: 3 },
];

export interface VoiceStory {
  id: string;
  text: string;
  keyDetails: string[];
  difficulty: 1 | 2 | 3;
}

export const VOICE_STORIES: VoiceStory[] = [
  {
    id: 'vs_dog_walk',
    text: 'Sam took his dog Bella to the park. Bella ran after a ball. She jumped in the pond. Sam laughed and dried her off with a towel.',
    keyDetails: ['sam', 'dog', 'bella', 'park', 'ball', 'pond', 'jumped', 'laughed', 'towel', 'dried'],
    difficulty: 1,
  },
  {
    id: 'vs_morning',
    text: 'Maria woke up early. She made coffee and toast. She sat by the window and watched the birds. Then she drove to work.',
    keyDetails: ['maria', 'woke', 'early', 'coffee', 'toast', 'window', 'birds', 'drove', 'work'],
    difficulty: 1,
  },
  {
    id: 'vs_store',
    text: 'Tom went to the store to buy milk. He also got bread and eggs. He forgot his wallet in the car. He had to go back and get it.',
    keyDetails: ['tom', 'store', 'milk', 'bread', 'eggs', 'wallet', 'car', 'forgot', 'go back'],
    difficulty: 1,
  },
  {
    id: 'vs_birthday',
    text: 'It was Amy\'s birthday. Her friends brought a cake with candles. They sang happy birthday. Amy made a wish and blew out the candles. Then they ate cake and played games in the yard.',
    keyDetails: ['amy', 'birthday', 'friends', 'cake', 'candles', 'sang', 'wish', 'blew', 'games', 'yard'],
    difficulty: 2,
  },
  {
    id: 'vs_garden',
    text: 'Mr. Lee planted tomatoes in his garden. Every morning he watered them. After a few weeks, the tomatoes turned red. He picked them and made soup for his neighbors.',
    keyDetails: ['mr lee', 'planted', 'tomatoes', 'garden', 'watered', 'morning', 'weeks', 'red', 'picked', 'soup', 'neighbors'],
    difficulty: 2,
  },
  {
    id: 'vs_airport',
    text: 'Sarah was flying to visit her sister. She packed her suitcase the night before. At the airport, she checked in and went through security. Her flight was delayed by two hours, so she read a book and had lunch at the gate. When she finally landed, her sister was waiting with a big hug.',
    keyDetails: ['sarah', 'flying', 'sister', 'suitcase', 'packed', 'airport', 'security', 'delayed', 'two hours', 'book', 'lunch', 'landed', 'hug'],
    difficulty: 3,
  },
];
