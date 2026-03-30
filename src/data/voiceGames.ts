/**
 * Voice Practice Mode — Game definitions for audio-only therapy
 * 
 * Each game can run entirely through voice (no visuals required).
 * Maya speaks prompts, user responds verbally, system scores.
 * 
 * KEY PRINCIPLE: Every prompt is anchored in real life.
 * "Name fruits" → "What fruits do you usually eat?"
 * Same therapy. Completely different feeling.
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

// ─── Session Topics ───
// Each topic ties multiple games into one conversational thread

export type SessionTopic = 
  | 'morning_routine'
  | 'food_and_cooking'
  | 'family_and_friends'
  | 'going_out'
  | 'around_the_house'
  | 'health_and_body';

export interface SessionTopicDef {
  topic: SessionTopic;
  label: string;
  openers: string[];
  /** Bias certain game types for this topic */
  preferredGames: VoiceGameType[];
}

export const SESSION_TOPICS: SessionTopicDef[] = [
  {
    topic: 'morning_routine',
    label: 'Your Morning',
    openers: [
      "Let's talk about your morning. I'll ask a few things — just answer naturally.",
      "Tell me about how your mornings usually go. We'll chat about it.",
      "Let's go through a typical morning together. Just talk to me.",
    ],
    preferredGames: ['category_fluency', 'sentence_expansion', 'fill_blank', 'yes_no_why'],
  },
  {
    topic: 'food_and_cooking',
    label: 'Food & Cooking',
    openers: [
      "Let's talk about food. I love hearing what people like to eat.",
      "Tell me about some of your favorite meals. We'll chat about food.",
      "Let's talk about cooking and eating — just say whatever comes to mind.",
    ],
    preferredGames: ['category_fluency', 'describe_without_naming', 'sentence_expansion', 'synonym_swap'],
  },
  {
    topic: 'family_and_friends',
    label: 'Family & Friends',
    openers: [
      "Let's talk about the people in your life. Tell me about someone close to you.",
      "I'd love to hear about your family or friends. Who comes to mind?",
      "Let's chat about the people you spend time with.",
    ],
    preferredGames: ['story_retell', 'sentence_expansion', 'yes_no_why', 'describe_without_naming'],
  },
  {
    topic: 'going_out',
    label: 'Going Out',
    openers: [
      "Let's talk about getting out and about. Where do you like to go?",
      "Tell me about places you like to visit. We'll practice talking about it.",
      "Let's chat about going out — stores, parks, restaurants, anything.",
    ],
    preferredGames: ['category_fluency', 'fill_blank', 'story_retell', 'opposites'],
  },
  {
    topic: 'around_the_house',
    label: 'Around the House',
    openers: [
      "Let's talk about things around the house. What did you do at home today?",
      "Tell me about your home — rooms, things you do, anything.",
      "Let's chat about everyday stuff at home.",
    ],
    preferredGames: ['category_fluency', 'describe_without_naming', 'fill_blank', 'sentence_expansion'],
  },
  {
    topic: 'health_and_body',
    label: 'Health & Body',
    openers: [
      "Let's talk about staying healthy. How are you feeling today?",
      "Tell me about things you do to take care of yourself.",
      "Let's chat about health — exercise, sleep, how you're doing.",
    ],
    preferredGames: ['yes_no_why', 'sentence_expansion', 'synonym_swap', 'opposites'],
  },
];

export const VOICE_GAMES: VoiceGameDef[] = [
  {
    type: 'story_retell',
    label: 'Story Retell',
    intro: "I'll tell you something that happened, then you tell it back to me — like you're telling a friend.",
    durationSec: 60,
    domain: 'discourse',
  },
  {
    type: 'category_fluency',
    label: 'Category Naming',
    intro: "Let's see what comes to mind. Just say whatever you think of.",
    durationSec: 30,
    domain: 'lexical_retrieval',
  },
  {
    type: 'sentence_expansion',
    label: 'Build a Sentence',
    intro: "I'll say something short, and you make it longer — add any details you want.",
    durationSec: 40,
    domain: 'syntax',
  },
  {
    type: 'synonym_swap',
    label: 'Word Swap',
    intro: "I'll say a word, and you give me a different word that means the same thing.",
    durationSec: 30,
    domain: 'semantic_depth',
  },
  {
    type: 'opposites',
    label: 'Opposites',
    intro: "Quick one — I say a word, you say the opposite.",
    durationSec: 25,
    domain: 'semantic_depth',
  },
  {
    type: 'fill_blank',
    label: 'Finish the Sentence',
    intro: "I'll start a sentence, you finish it. Say whatever feels right.",
    durationSec: 30,
    domain: 'syntax',
  },
  {
    type: 'describe_without_naming',
    label: 'Describe It',
    intro: "Describe something for me without saying its name — like you're giving someone a hint.",
    durationSec: 40,
    domain: 'semantic_depth',
  },
  {
    type: 'yes_no_why',
    label: 'Tell Me Why',
    intro: "I'll ask you something. Tell me what you think — and why.",
    durationSec: 30,
    domain: 'discourse',
  },
];

// ─── Game Stimuli (now with topic-anchored conversational prompts) ───

export interface CategoryPrompt {
  category: string;
  /** Conversational prompt (not "Name X") */
  conversationalPrompt: string;
  examples: string[];
  difficulty: 1 | 2 | 3;
  topics: SessionTopic[];
}

export const CATEGORY_PROMPTS: CategoryPrompt[] = [
  { category: 'animals', conversationalPrompt: "What animals do you like? Name as many as you can.", examples: ['dog','cat','bird','fish','horse','cow','pig','rabbit','mouse','lion','tiger','bear','elephant','monkey','snake','chicken','duck','sheep','goat','deer'], difficulty: 1, topics: ['around_the_house', 'family_and_friends'] },
  { category: 'fruits', conversationalPrompt: "What fruits do you usually eat? Tell me all the ones you like.", examples: ['apple','banana','orange','grape','strawberry','blueberry','pear','peach','mango','watermelon','cherry','lemon','lime','pineapple','kiwi'], difficulty: 1, topics: ['food_and_cooking', 'morning_routine'] },
  { category: 'things in a kitchen', conversationalPrompt: "Think about your kitchen. What's in there?", examples: ['stove','oven','fridge','sink','cup','plate','bowl','fork','knife','spoon','pan','pot','microwave','toaster','table','chair','glass','mug'], difficulty: 1, topics: ['around_the_house', 'food_and_cooking'] },
  { category: 'clothing', conversationalPrompt: "What do you usually wear? Name whatever comes to mind.", examples: ['shirt','pants','shoes','socks','hat','jacket','coat','dress','skirt','sweater','scarf','gloves','boots','belt','tie','shorts'], difficulty: 1, topics: ['morning_routine', 'going_out'] },
  { category: 'things at a grocery store', conversationalPrompt: "If you went to the grocery store, what would you pick up?", examples: ['bread','milk','eggs','cheese','butter','cereal','rice','pasta','chicken','beef','tomato','lettuce','apple','banana','juice','water','soap','paper'], difficulty: 2, topics: ['food_and_cooking', 'going_out'] },
  { category: 'things that are red', conversationalPrompt: "What things can you think of that are red?", examples: ['apple','tomato','fire','blood','rose','cherry','strawberry','stop sign','ladybug','heart','cardinal','brick','pepper'], difficulty: 2, topics: ['around_the_house', 'going_out'] },
  { category: 'things you do in the morning', conversationalPrompt: "Walk me through your morning — what do you do after waking up?", examples: ['wake up','brush teeth','shower','get dressed','eat breakfast','drink coffee','make bed','check phone','stretch','exercise','wash face'], difficulty: 2, topics: ['morning_routine', 'health_and_body'] },
  { category: 'jobs or occupations', conversationalPrompt: "What jobs can you think of? Anyone you know does something interesting?", examples: ['doctor','teacher','nurse','firefighter','police','chef','driver','pilot','lawyer','dentist','farmer','builder','artist','writer','singer'], difficulty: 3, topics: ['family_and_friends', 'going_out'] },
  { category: 'things at a hospital', conversationalPrompt: "Have you been to a hospital? What do you see there?", examples: ['bed','doctor','nurse','medicine','needle','bandage','wheelchair','ambulance','x-ray','stethoscope','chart','mask','gloves','waiting room'], difficulty: 3, topics: ['health_and_body'] },
];

export interface SentenceExpansionPrompt {
  starter: string;
  /** Conversational expansion cue */
  expansionCue: string;
  expansionHints: string[];
  difficulty: 1 | 2 | 3;
  topics: SessionTopic[];
}

export const SENTENCE_EXPANSION_PROMPTS: SentenceExpansionPrompt[] = [
  { starter: 'I went outside', expansionCue: 'Now add where you went.', expansionHints: ['Where did you go?', 'What did you see?', 'Who was with you?'], difficulty: 1, topics: ['morning_routine', 'going_out'] },
  { starter: 'I ate breakfast', expansionCue: 'Now tell me what you ate.', expansionHints: ['What did you eat?', 'Where did you eat?', 'How did it taste?'], difficulty: 1, topics: ['morning_routine', 'food_and_cooking'] },
  { starter: 'I saw a dog', expansionCue: "What was the dog like? Add some detail.", expansionHints: ['What color was it?', 'What was it doing?', 'Where was it?'], difficulty: 1, topics: ['going_out', 'around_the_house'] },
  { starter: 'She went to the store', expansionCue: 'What did she go for? Make the sentence longer.', expansionHints: ['Which store?', 'What did she buy?', 'Why did she go?'], difficulty: 2, topics: ['going_out', 'food_and_cooking'] },
  { starter: 'The man was happy', expansionCue: 'Why was he happy? Add that in.', expansionHints: ['Why was he happy?', 'What did he do?', 'Who was he with?'], difficulty: 2, topics: ['family_and_friends'] },
  { starter: 'It started raining', expansionCue: 'What happened next? Keep going.', expansionHints: ['What happened next?', 'Where were you?', 'What did you do?'], difficulty: 2, topics: ['going_out', 'around_the_house'] },
  { starter: 'They drove to the beach', expansionCue: 'Tell me more — how long, what they did.', expansionHints: ['How long did it take?', 'What did they bring?', 'What did they do there?'], difficulty: 3, topics: ['going_out', 'family_and_friends'] },
];

export interface SynonymPrompt {
  word: string;
  /** Conversational framing */
  conversationalPrompt: string;
  synonyms: string[];
  difficulty: 1 | 2 | 3;
}

export const SYNONYM_PROMPTS: SynonymPrompt[] = [
  { word: 'big', conversationalPrompt: "If something is really big, what else could you call it?", synonyms: ['large','huge','enormous','giant','massive'], difficulty: 1 },
  { word: 'happy', conversationalPrompt: "Another way to say you're happy?", synonyms: ['glad','joyful','cheerful','pleased','delighted'], difficulty: 1 },
  { word: 'fast', conversationalPrompt: "If something moves really fast, what's another word for that?", synonyms: ['quick','speedy','rapid','swift'], difficulty: 1 },
  { word: 'sad', conversationalPrompt: "What's another word for feeling sad?", synonyms: ['unhappy','upset','miserable','gloomy','down'], difficulty: 1 },
  { word: 'cold', conversationalPrompt: "If it's really cold outside, how else could you describe it?", synonyms: ['chilly','freezing','cool','icy','frigid'], difficulty: 1 },
  { word: 'smart', conversationalPrompt: "If someone is really smart, what else could you say?", synonyms: ['clever','intelligent','bright','wise','sharp'], difficulty: 2 },
  { word: 'angry', conversationalPrompt: "What's another way to say someone is angry?", synonyms: ['mad','furious','upset','irritated','annoyed'], difficulty: 2 },
  { word: 'beautiful', conversationalPrompt: "If something is beautiful, what's another word for that?", synonyms: ['pretty','gorgeous','lovely','stunning','attractive'], difficulty: 2 },
  { word: 'scary', conversationalPrompt: "How else could you describe something scary?", synonyms: ['frightening','terrifying','creepy','spooky','alarming'], difficulty: 2 },
  { word: 'start', conversationalPrompt: "What's another way to say you start something?", synonyms: ['begin','commence','launch','initiate','kick off'], difficulty: 3 },
  { word: 'important', conversationalPrompt: "If something is really important, what else could you say?", synonyms: ['significant','crucial','vital','essential','key'], difficulty: 3 },
];

export interface OppositePrompt {
  word: string;
  /** Real-life context framing */
  conversationalPrompt: string;
  opposite: string;
  difficulty: 1 | 2 | 3;
}

export const OPPOSITE_PROMPTS: OppositePrompt[] = [
  { word: 'hot', conversationalPrompt: "If your coffee is too hot… what's the opposite?", opposite: 'cold', difficulty: 1 },
  { word: 'big', conversationalPrompt: "If something is really big, the opposite would be?", opposite: 'small', difficulty: 1 },
  { word: 'fast', conversationalPrompt: "A car that's fast — what's the opposite?", opposite: 'slow', difficulty: 1 },
  { word: 'up', conversationalPrompt: "If you go up, the opposite is?", opposite: 'down', difficulty: 1 },
  { word: 'happy', conversationalPrompt: "You're feeling happy — what's the opposite feeling?", opposite: 'sad', difficulty: 1 },
  { word: 'old', conversationalPrompt: "Someone who is old — what's the opposite?", opposite: 'young', difficulty: 1 },
  { word: 'light', conversationalPrompt: "If a room is light, the opposite is?", opposite: 'dark', difficulty: 1 },
  { word: 'open', conversationalPrompt: "The door is open — what's the opposite?", opposite: 'closed', difficulty: 1 },
  { word: 'hard', conversationalPrompt: "If a pillow is hard, the opposite would be?", opposite: 'soft', difficulty: 2 },
  { word: 'loud', conversationalPrompt: "Music that's really loud — what's the opposite?", opposite: 'quiet', difficulty: 2 },
  { word: 'early', conversationalPrompt: "If you arrive early, the opposite is?", opposite: 'late', difficulty: 2 },
  { word: 'shallow', conversationalPrompt: "A pool that's shallow — the opposite?", opposite: 'deep', difficulty: 2 },
  { word: 'brave', conversationalPrompt: "Someone who is brave — what's the opposite?", opposite: 'cowardly', difficulty: 3 },
  { word: 'generous', conversationalPrompt: "A person who is generous — the opposite?", opposite: 'selfish', difficulty: 3 },
  { word: 'temporary', conversationalPrompt: "If something is temporary, the opposite would be?", opposite: 'permanent', difficulty: 3 },
];

export interface FillBlankPrompt {
  sentence: string;
  answer: string[];
  difficulty: 1 | 2 | 3;
  topics: SessionTopic[];
}

export const FILL_BLANK_PROMPTS: FillBlankPrompt[] = [
  { sentence: 'I drink coffee in the ____', answer: ['morning'], difficulty: 1, topics: ['morning_routine', 'food_and_cooking'] },
  { sentence: 'You sleep in a ____', answer: ['bed'], difficulty: 1, topics: ['around_the_house', 'morning_routine'] },
  { sentence: 'The sun comes up in the ____', answer: ['morning','east'], difficulty: 1, topics: ['morning_routine'] },
  { sentence: 'You wash your hands with soap and ____', answer: ['water'], difficulty: 1, topics: ['health_and_body', 'around_the_house'] },
  { sentence: 'A doctor works at a ____', answer: ['hospital','clinic','office'], difficulty: 1, topics: ['health_and_body'] },
  { sentence: 'You cut food with a ____', answer: ['knife'], difficulty: 2, topics: ['food_and_cooking', 'around_the_house'] },
  { sentence: 'When it rains you need an ____', answer: ['umbrella'], difficulty: 2, topics: ['going_out'] },
  { sentence: 'Books are kept in a ____', answer: ['library','shelf','bookcase','bookshelf'], difficulty: 2, topics: ['around_the_house'] },
  { sentence: 'The opposite of love is ____', answer: ['hate','hatred'], difficulty: 3, topics: ['family_and_friends'] },
  { sentence: 'A group of fish is called a ____', answer: ['school','shoal'], difficulty: 3, topics: ['going_out'] },
];

export interface DescribePrompt {
  word: string;
  hints: string[];
  difficulty: 1 | 2 | 3;
  topics: SessionTopic[];
}

export const DESCRIBE_PROMPTS: DescribePrompt[] = [
  { word: 'car', hints: ['you drive it', 'has four wheels', 'you travel in it'], difficulty: 1, topics: ['going_out'] },
  { word: 'dog', hints: ['an animal', 'it barks', 'a pet'], difficulty: 1, topics: ['around_the_house', 'family_and_friends'] },
  { word: 'phone', hints: ['you call people', 'has a screen', 'you hold it'], difficulty: 1, topics: ['around_the_house', 'family_and_friends'] },
  { word: 'umbrella', hints: ['protects from rain', 'you open it', 'you hold it above your head'], difficulty: 2, topics: ['going_out'] },
  { word: 'refrigerator', hints: ['keeps food cold', 'in the kitchen', 'has a door'], difficulty: 2, topics: ['around_the_house', 'food_and_cooking'] },
  { word: 'dentist', hints: ['a person', 'checks your teeth', 'you sit in a chair'], difficulty: 3, topics: ['health_and_body'] },
  { word: 'library', hints: ['a building', 'has many books', 'you must be quiet'], difficulty: 3, topics: ['going_out'] },
];

export interface YesNoPrompt {
  question: string;
  difficulty: 1 | 2 | 3;
  topics: SessionTopic[];
}

export const YES_NO_PROMPTS: YesNoPrompt[] = [
  { question: 'Do you like coffee in the morning?', difficulty: 1, topics: ['morning_routine', 'food_and_cooking'] },
  { question: 'Is exercise good for you?', difficulty: 1, topics: ['health_and_body'] },
  { question: 'Do you enjoy listening to music?', difficulty: 1, topics: ['around_the_house'] },
  { question: 'Do you think dogs make good pets?', difficulty: 2, topics: ['around_the_house', 'family_and_friends'] },
  { question: 'Would you rather eat at home or go to a restaurant?', difficulty: 2, topics: ['food_and_cooking', 'going_out'] },
  { question: 'Is it important to eat breakfast every day?', difficulty: 2, topics: ['morning_routine', 'food_and_cooking'] },
  { question: 'Do you prefer mornings or evenings?', difficulty: 3, topics: ['morning_routine'] },
  { question: 'Is spending time with family the most important thing?', difficulty: 3, topics: ['family_and_friends'] },
];

export interface VoiceStory {
  id: string;
  text: string;
  keyDetails: string[];
  difficulty: 1 | 2 | 3;
  topics: SessionTopic[];
}

export const VOICE_STORIES: VoiceStory[] = [
  {
    id: 'vs_dog_walk',
    text: 'Sam took his dog Bella to the park. Bella ran after a ball. She jumped in the pond. Sam laughed and dried her off with a towel.',
    keyDetails: ['sam', 'dog', 'bella', 'park', 'ball', 'pond', 'jumped', 'laughed', 'towel', 'dried'],
    difficulty: 1,
    topics: ['going_out', 'family_and_friends'],
  },
  {
    id: 'vs_morning',
    text: 'Maria woke up early. She made coffee and toast. She sat by the window and watched the birds. Then she drove to work.',
    keyDetails: ['maria', 'woke', 'early', 'coffee', 'toast', 'window', 'birds', 'drove', 'work'],
    difficulty: 1,
    topics: ['morning_routine'],
  },
  {
    id: 'vs_store',
    text: 'Tom went to the store to buy milk. He also got bread and eggs. He forgot his wallet in the car. He had to go back and get it.',
    keyDetails: ['tom', 'store', 'milk', 'bread', 'eggs', 'wallet', 'car', 'forgot', 'go back'],
    difficulty: 1,
    topics: ['going_out', 'food_and_cooking'],
  },
  {
    id: 'vs_birthday',
    text: "It was Amy's birthday. Her friends brought a cake with candles. They sang happy birthday. Amy made a wish and blew out the candles. Then they ate cake and played games in the yard.",
    keyDetails: ['amy', 'birthday', 'friends', 'cake', 'candles', 'sang', 'wish', 'blew', 'games', 'yard'],
    difficulty: 2,
    topics: ['family_and_friends'],
  },
  {
    id: 'vs_garden',
    text: 'Mr. Lee planted tomatoes in his garden. Every morning he watered them. After a few weeks, the tomatoes turned red. He picked them and made soup for his neighbors.',
    keyDetails: ['mr lee', 'planted', 'tomatoes', 'garden', 'watered', 'morning', 'weeks', 'red', 'picked', 'soup', 'neighbors'],
    difficulty: 2,
    topics: ['around_the_house', 'food_and_cooking'],
  },
  {
    id: 'vs_airport',
    text: 'Sarah was flying to visit her sister. She packed her suitcase the night before. At the airport, she checked in and went through security. Her flight was delayed by two hours, so she read a book and had lunch at the gate. When she finally landed, her sister was waiting with a big hug.',
    keyDetails: ['sarah', 'flying', 'sister', 'suitcase', 'packed', 'airport', 'security', 'delayed', 'two hours', 'book', 'lunch', 'landed', 'hug'],
    difficulty: 3,
    topics: ['going_out', 'family_and_friends'],
  },
];
