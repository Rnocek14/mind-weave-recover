export type SentenceTaskType = 
  | "word_order" 
  | "sentence_reorder";

export type GrammarErrorType = 
  | "word_order" 
  | "extra_word_selected"
  | "missing_word"
  | "tense_error"
  | "agreement_error"
  | "conjunction_error"
  | "clause_order_error"
  | "relative_clause_error"
  | "passive_voice_error";

export interface SentenceTrial {
  id: string;
  taskType: SentenceTaskType;
  difficulty: number; // 1-10
  targetSentence: string; // correct answer
  options: string[]; // word options to choose from (includes distractors)
  correctAnswer: string[]; // ordered array of words
  distractors: string[]; // incorrect options (words that shouldn't be used)
  grammarFocus: string; // e.g., "SVO", "articles", "past_tense"
  modelAudio?: string; // text for TTS (played AFTER submission as feedback)
}

// Level 1: Basic SVO (4-5 words, no distractors)
const level1Trials: SentenceTrial[] = [
  {
    id: "svo_1",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The dog chases the cat",
    options: ["cat", "the", "chases", "dog", "the"],
    correctAnswer: ["The", "dog", "chases", "the", "cat"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The dog chases the cat"
  },
  {
    id: "svo_2",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The boy kicks the ball",
    options: ["ball", "boy", "the", "kicks", "the"],
    correctAnswer: ["The", "boy", "kicks", "the", "ball"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The boy kicks the ball"
  },
  {
    id: "svo_3",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The girl reads a book",
    options: ["book", "a", "girl", "reads", "the"],
    correctAnswer: ["The", "girl", "reads", "a", "book"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The girl reads a book"
  },
  {
    id: "svo_4",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The man drives a car",
    options: ["car", "drives", "man", "a", "the"],
    correctAnswer: ["The", "man", "drives", "a", "car"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The man drives a car"
  },
  {
    id: "svo_5",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The baby drinks milk",
    options: ["milk", "drinks", "baby", "the"],
    correctAnswer: ["The", "baby", "drinks", "milk"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The baby drinks milk"
  },
  {
    id: "svo_6",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The bird flies high",
    options: ["high", "flies", "bird", "the"],
    correctAnswer: ["The", "bird", "flies", "high"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The bird flies high"
  },
  {
    id: "svo_7",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The woman cooks food",
    options: ["food", "cooks", "woman", "the"],
    correctAnswer: ["The", "woman", "cooks", "food"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The woman cooks food"
  },
  {
    id: "svo_8",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The fish swims fast",
    options: ["fast", "swims", "fish", "the"],
    correctAnswer: ["The", "fish", "swims", "fast"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The fish swims fast"
  },
  {
    id: "svo_9",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The cat sleeps here",
    options: ["here", "cat", "sleeps", "the"],
    correctAnswer: ["The", "cat", "sleeps", "here"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The cat sleeps here"
  },
  {
    id: "svo_10",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "She eats an apple",
    options: ["apple", "an", "eats", "she"],
    correctAnswer: ["She", "eats", "an", "apple"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "She eats an apple"
  }
];

// Level 2: Basic sentences with 1 distractor (5-6 words)
const level2Trials: SentenceTrial[] = [
  {
    id: "dist1_1",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The apple is red",
    options: ["red", "is", "apple", "the", "blue"],
    correctAnswer: ["The", "apple", "is", "red"],
    distractors: ["blue"],
    grammarFocus: "SVO_adjectives",
    modelAudio: "The apple is red"
  },
  {
    id: "dist1_2",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "She goes to the store",
    options: ["store", "goes", "the", "to", "she", "he"],
    correctAnswer: ["She", "goes", "to", "the", "store"],
    distractors: ["he"],
    grammarFocus: "prepositions",
    modelAudio: "She goes to the store"
  },
  {
    id: "dist1_3",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "I am going home",
    options: ["home", "going", "am", "I", "are"],
    correctAnswer: ["I", "am", "going", "home"],
    distractors: ["are"],
    grammarFocus: "copula",
    modelAudio: "I am going home"
  },
  {
    id: "dist1_4",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The cat is on the table",
    options: ["table", "on", "is", "cat", "the", "the", "under"],
    correctAnswer: ["The", "cat", "is", "on", "the", "table"],
    distractors: ["under"],
    grammarFocus: "prepositions",
    modelAudio: "The cat is on the table"
  },
  {
    id: "dist1_5",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "We live in a house",
    options: ["house", "a", "in", "live", "we", "at"],
    correctAnswer: ["We", "live", "in", "a", "house"],
    distractors: ["at"],
    grammarFocus: "prepositions",
    modelAudio: "We live in a house"
  },
  {
    id: "dist1_6",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The dog barks loud",
    options: ["loud", "barks", "dog", "the", "quiet"],
    correctAnswer: ["The", "dog", "barks", "loud"],
    distractors: ["quiet"],
    grammarFocus: "adverbs",
    modelAudio: "The dog barks loud"
  },
  {
    id: "dist1_7",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "He sits on the chair",
    options: ["chair", "the", "on", "sits", "he", "in"],
    correctAnswer: ["He", "sits", "on", "the", "chair"],
    distractors: ["in"],
    grammarFocus: "prepositions",
    modelAudio: "He sits on the chair"
  },
  {
    id: "dist1_8",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "I have an apple",
    options: ["apple", "an", "have", "I", "a"],
    correctAnswer: ["I", "have", "an", "apple"],
    distractors: ["a"],
    grammarFocus: "articles",
    modelAudio: "I have an apple"
  },
  {
    id: "dist1_9",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "They play in the park",
    options: ["park", "the", "in", "play", "they", "at"],
    correctAnswer: ["They", "play", "in", "the", "park"],
    distractors: ["at"],
    grammarFocus: "prepositions",
    modelAudio: "They play in the park"
  },
  {
    id: "dist1_10",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The sun is bright",
    options: ["bright", "is", "sun", "the", "dark"],
    correctAnswer: ["The", "sun", "is", "bright"],
    distractors: ["dark"],
    grammarFocus: "adjectives",
    modelAudio: "The sun is bright"
  }
];

// Level 3: Verb agreement focus with 1-2 distractors (5-6 words)
const level3Trials: SentenceTrial[] = [
  {
    id: "verb_1",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "He eats dinner every day",
    options: ["day", "every", "dinner", "eats", "he", "eat"],
    correctAnswer: ["He", "eats", "dinner", "every", "day"],
    distractors: ["eat"],
    grammarFocus: "subject_verb_agreement",
    modelAudio: "He eats dinner every day"
  },
  {
    id: "verb_2",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "They are running fast",
    options: ["fast", "running", "are", "they", "is"],
    correctAnswer: ["They", "are", "running", "fast"],
    distractors: ["is"],
    grammarFocus: "plural_agreement",
    modelAudio: "They are running fast"
  },
  {
    id: "verb_3",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "She walks to school",
    options: ["school", "to", "walks", "she", "walk", "run"],
    correctAnswer: ["She", "walks", "to", "school"],
    distractors: ["walk", "run"],
    grammarFocus: "third_person_singular",
    modelAudio: "She walks to school"
  },
  {
    id: "verb_4",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "I was playing outside",
    options: ["outside", "playing", "was", "I", "were"],
    correctAnswer: ["I", "was", "playing", "outside"],
    distractors: ["were"],
    grammarFocus: "past_progressive",
    modelAudio: "I was playing outside"
  },
  {
    id: "verb_5",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "The baby cries loudly",
    options: ["loudly", "cries", "baby", "the", "cry"],
    correctAnswer: ["The", "baby", "cries", "loudly"],
    distractors: ["cry"],
    grammarFocus: "third_person_singular",
    modelAudio: "The baby cries loudly"
  },
  {
    id: "verb_6",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "The birds fly south",
    options: ["south", "fly", "birds", "the", "flies"],
    correctAnswer: ["The", "birds", "fly", "south"],
    distractors: ["flies"],
    grammarFocus: "plural_agreement",
    modelAudio: "The birds fly south"
  },
  {
    id: "verb_7",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "He goes to work",
    options: ["work", "to", "goes", "he", "go"],
    correctAnswer: ["He", "goes", "to", "work"],
    distractors: ["go"],
    grammarFocus: "third_person_singular",
    modelAudio: "He goes to work"
  },
  {
    id: "verb_8",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "We eat dinner together",
    options: ["together", "dinner", "eat", "we", "eats"],
    correctAnswer: ["We", "eat", "dinner", "together"],
    distractors: ["eats"],
    grammarFocus: "plural_agreement",
    modelAudio: "We eat dinner together"
  },
  {
    id: "verb_9",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "The children play games",
    options: ["games", "play", "children", "the", "plays"],
    correctAnswer: ["The", "children", "play", "games"],
    distractors: ["plays"],
    grammarFocus: "plural_agreement",
    modelAudio: "The children play games"
  },
  {
    id: "verb_10",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "She has two cats",
    options: ["cats", "two", "has", "she", "have"],
    correctAnswer: ["She", "has", "two", "cats"],
    distractors: ["have"],
    grammarFocus: "third_person_singular",
    modelAudio: "She has two cats"
  }
];

// Level 4: Longer sentences with prepositional phrases (6-7 words, 1-2 distractors)
const level4Trials: SentenceTrial[] = [
  {
    id: "prep_1",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "I went to the store yesterday",
    options: ["yesterday", "store", "the", "to", "went", "I", "tomorrow"],
    correctAnswer: ["I", "went", "to", "the", "store", "yesterday"],
    distractors: ["tomorrow"],
    grammarFocus: "word_order_complex",
    modelAudio: "I went to the store yesterday"
  },
  {
    id: "prep_2",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "She gave me the book",
    options: ["book", "the", "me", "gave", "she", "him"],
    correctAnswer: ["She", "gave", "me", "the", "book"],
    distractors: ["him"],
    grammarFocus: "ditransitive",
    modelAudio: "She gave me the book"
  },
  {
    id: "prep_3",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "The dog is sleeping under the bed",
    options: ["bed", "the", "under", "sleeping", "is", "dog", "the", "on"],
    correctAnswer: ["The", "dog", "is", "sleeping", "under", "the", "bed"],
    distractors: ["on"],
    grammarFocus: "prepositional_phrase",
    modelAudio: "The dog is sleeping under the bed"
  },
  {
    id: "prep_4",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "My mother bakes cookies",
    options: ["cookies", "bakes", "mother", "my", "cakes"],
    correctAnswer: ["My", "mother", "bakes", "cookies"],
    distractors: ["cakes"],
    grammarFocus: "word_order_complex",
    modelAudio: "My mother bakes cookies"
  },
  {
    id: "prep_5",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "The baby sleeps in the crib",
    options: ["crib", "the", "in", "sleeps", "baby", "the", "on"],
    correctAnswer: ["The", "baby", "sleeps", "in", "the", "crib"],
    distractors: ["on"],
    grammarFocus: "prepositional_phrase",
    modelAudio: "The baby sleeps in the crib"
  },
  {
    id: "prep_6",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "We eat breakfast every morning",
    options: ["morning", "every", "breakfast", "eat", "we", "night"],
    correctAnswer: ["We", "eat", "breakfast", "every", "morning"],
    distractors: ["night"],
    grammarFocus: "word_order_complex",
    modelAudio: "We eat breakfast every morning"
  },
  {
    id: "prep_7",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "He put the cup on the table",
    options: ["table", "the", "on", "cup", "the", "put", "he", "under"],
    correctAnswer: ["He", "put", "the", "cup", "on", "the", "table"],
    distractors: ["under"],
    grammarFocus: "prepositional_phrase",
    modelAudio: "He put the cup on the table"
  },
  {
    id: "prep_8",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "They walked to the park",
    options: ["park", "the", "to", "walked", "they", "ran"],
    correctAnswer: ["They", "walked", "to", "the", "park"],
    distractors: ["ran"],
    grammarFocus: "word_order_complex",
    modelAudio: "They walked to the park"
  }
];

// Level 5: Past tense and complex verb forms (6-7 words, 2 distractors)
const level5Trials: SentenceTrial[] = [
  {
    id: "past_1",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "She kicked the ball hard",
    options: ["hard", "ball", "the", "kicked", "she", "kicks", "softly"],
    correctAnswer: ["She", "kicked", "the", "ball", "hard"],
    distractors: ["kicks", "softly"],
    grammarFocus: "past_tense",
    modelAudio: "She kicked the ball hard"
  },
  {
    id: "past_2",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "They were eating lunch together",
    options: ["together", "lunch", "eating", "were", "they", "was", "dinner"],
    correctAnswer: ["They", "were", "eating", "lunch", "together"],
    distractors: ["was", "dinner"],
    grammarFocus: "past_progressive",
    modelAudio: "They were eating lunch together"
  },
  {
    id: "past_3",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "He has finished his homework",
    options: ["homework", "his", "finished", "has", "he", "have", "started"],
    correctAnswer: ["He", "has", "finished", "his", "homework"],
    distractors: ["have", "started"],
    grammarFocus: "present_perfect",
    modelAudio: "He has finished his homework"
  },
  {
    id: "past_4",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "The children are playing together",
    options: ["together", "playing", "are", "children", "the", "is", "fighting"],
    correctAnswer: ["The", "children", "are", "playing", "together"],
    distractors: ["is", "fighting"],
    grammarFocus: "present_progressive",
    modelAudio: "The children are playing together"
  },
  {
    id: "past_5",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "I read the book yesterday",
    options: ["yesterday", "book", "the", "read", "I", "reads", "tomorrow"],
    correctAnswer: ["I", "read", "the", "book", "yesterday"],
    distractors: ["reads", "tomorrow"],
    grammarFocus: "past_tense",
    modelAudio: "I read the book yesterday"
  },
  {
    id: "past_6",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "She was crying when I arrived",
    options: ["arrived", "I", "when", "crying", "was", "she", "were", "laughing"],
    correctAnswer: ["She", "was", "crying", "when", "I", "arrived"],
    distractors: ["were", "laughing"],
    grammarFocus: "past_progressive",
    modelAudio: "She was crying when I arrived"
  },
  {
    id: "past_7",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "They have already left",
    options: ["left", "already", "have", "they", "has", "arrived"],
    correctAnswer: ["They", "have", "already", "left"],
    distractors: ["has", "arrived"],
    grammarFocus: "present_perfect",
    modelAudio: "They have already left"
  },
  {
    id: "past_8",
    taskType: "sentence_reorder",
    difficulty: 5,
    targetSentence: "We went to the park last week",
    options: ["week", "last", "park", "the", "to", "went", "we", "next", "mall"],
    correctAnswer: ["We", "went", "to", "the", "park", "last", "week"],
    distractors: ["next", "mall"],
    grammarFocus: "past_tense",
    modelAudio: "We went to the park last week"
  }
];

// Level 6: Compound Sentences with coordinating conjunctions (8-9 words, 2 distractors)
const level6Trials: SentenceTrial[] = [
  {
    id: "compound_1",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "I went to the store and bought some bread",
    options: ["bread", "some", "bought", "and", "store", "the", "to", "went", "I", "or", "milk"],
    correctAnswer: ["I", "went", "to", "the", "store", "and", "bought", "some", "bread"],
    distractors: ["or", "milk"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "I went to the store and bought some bread"
  },
  {
    id: "compound_2",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "She was tired but she finished her work",
    options: ["work", "her", "finished", "she", "but", "tired", "was", "she", "and", "started"],
    correctAnswer: ["She", "was", "tired", "but", "she", "finished", "her", "work"],
    distractors: ["and", "started"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "She was tired but she finished her work"
  },
  {
    id: "compound_3",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "The dog barked and the cat ran away",
    options: ["away", "ran", "cat", "the", "and", "barked", "dog", "the", "or", "walked"],
    correctAnswer: ["The", "dog", "barked", "and", "the", "cat", "ran", "away"],
    distractors: ["or", "walked"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "The dog barked and the cat ran away"
  },
  {
    id: "compound_4",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "I wanted coffee but the shop was closed",
    options: ["closed", "was", "shop", "the", "but", "coffee", "wanted", "I", "and", "open"],
    correctAnswer: ["I", "wanted", "coffee", "but", "the", "shop", "was", "closed"],
    distractors: ["and", "open"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "I wanted coffee but the shop was closed"
  },
  {
    id: "compound_5",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "You can have tea or you can have juice",
    options: ["juice", "have", "can", "you", "or", "tea", "have", "can", "you", "and", "water"],
    correctAnswer: ["You", "can", "have", "tea", "or", "you", "can", "have", "juice"],
    distractors: ["and", "water"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "You can have tea or you can have juice"
  },
  {
    id: "compound_6",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "He studied hard so he passed the test",
    options: ["test", "the", "passed", "he", "so", "hard", "studied", "he", "but", "failed"],
    correctAnswer: ["He", "studied", "hard", "so", "he", "passed", "the", "test"],
    distractors: ["but", "failed"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "He studied hard so he passed the test"
  },
  {
    id: "compound_7",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "The movie was long and it was boring",
    options: ["boring", "was", "it", "and", "long", "was", "movie", "the", "but", "exciting"],
    correctAnswer: ["The", "movie", "was", "long", "and", "it", "was", "boring"],
    distractors: ["but", "exciting"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "The movie was long and it was boring"
  },
  {
    id: "compound_8",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "We can stay home or we can go out",
    options: ["out", "go", "can", "we", "or", "home", "stay", "can", "we", "and", "work"],
    correctAnswer: ["We", "can", "stay", "home", "or", "we", "can", "go", "out"],
    distractors: ["and", "work"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "We can stay home or we can go out"
  }
];

// Level 7: Complex Sentences with subordinating conjunctions (8-9 words, 2 distractors)
const level7Trials: SentenceTrial[] = [
  {
    id: "subordinate_1",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "Because it was raining we stayed inside",
    options: ["inside", "stayed", "we", "raining", "was", "it", "because", "although", "outside"],
    correctAnswer: ["Because", "it", "was", "raining", "we", "stayed", "inside"],
    distractors: ["although", "outside"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "Because it was raining we stayed inside"
  },
  {
    id: "subordinate_2",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "When the phone rang she answered it quickly",
    options: ["quickly", "it", "answered", "she", "rang", "phone", "the", "when", "before", "slowly"],
    correctAnswer: ["When", "the", "phone", "rang", "she", "answered", "it", "quickly"],
    distractors: ["before", "slowly"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "When the phone rang she answered it quickly"
  },
  {
    id: "subordinate_3",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "Although he was tired he kept working",
    options: ["working", "kept", "he", "tired", "was", "he", "although", "because", "sleeping"],
    correctAnswer: ["Although", "he", "was", "tired", "he", "kept", "working"],
    distractors: ["because", "sleeping"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "Although he was tired he kept working"
  },
  {
    id: "subordinate_4",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "If you need help please ask me",
    options: ["me", "ask", "please", "help", "need", "you", "if", "when", "her"],
    correctAnswer: ["If", "you", "need", "help", "please", "ask", "me"],
    distractors: ["when", "her"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "If you need help please ask me"
  },
  {
    id: "subordinate_5",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "While I was cooking dinner he set the table",
    options: ["table", "the", "set", "he", "dinner", "cooking", "was", "I", "while", "after", "cleaned"],
    correctAnswer: ["While", "I", "was", "cooking", "dinner", "he", "set", "the", "table"],
    distractors: ["after", "cleaned"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "While I was cooking dinner he set the table"
  },
  {
    id: "subordinate_6",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "She left early because she had an appointment",
    options: ["appointment", "an", "had", "she", "because", "early", "left", "she", "although", "meeting"],
    correctAnswer: ["She", "left", "early", "because", "she", "had", "an", "appointment"],
    distractors: ["although", "meeting"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "She left early because she had an appointment"
  },
  {
    id: "subordinate_7",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "Before you leave please turn off the lights",
    options: ["lights", "the", "off", "turn", "please", "leave", "you", "before", "after", "on"],
    correctAnswer: ["Before", "you", "leave", "please", "turn", "off", "the", "lights"],
    distractors: ["after", "on"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "Before you leave please turn off the lights"
  },
  {
    id: "subordinate_8",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "After the movie ended we went for ice cream",
    options: ["cream", "ice", "for", "went", "we", "ended", "movie", "the", "after", "before", "dinner"],
    correctAnswer: ["After", "the", "movie", "ended", "we", "went", "for", "ice", "cream"],
    distractors: ["before", "dinner"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "After the movie ended we went for ice cream"
  }
];

// Level 8: Relative Clauses (9-10 words, 2-3 distractors)
const level8Trials: SentenceTrial[] = [
  {
    id: "relative_1",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The man who lives next door is a doctor",
    options: ["doctor", "a", "is", "door", "next", "lives", "who", "man", "the", "which", "nurse"],
    correctAnswer: ["The", "man", "who", "lives", "next", "door", "is", "a", "doctor"],
    distractors: ["which", "nurse"],
    grammarFocus: "relative_clauses",
    modelAudio: "The man who lives next door is a doctor"
  },
  {
    id: "relative_2",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "I saw the movie that you recommended",
    options: ["recommended", "you", "that", "movie", "the", "saw", "I", "which", "hated"],
    correctAnswer: ["I", "saw", "the", "movie", "that", "you", "recommended"],
    distractors: ["which", "hated"],
    grammarFocus: "relative_clauses",
    modelAudio: "I saw the movie that you recommended"
  },
  {
    id: "relative_3",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The book which I borrowed was very interesting",
    options: ["interesting", "very", "was", "borrowed", "I", "which", "book", "the", "who", "boring"],
    correctAnswer: ["The", "book", "which", "I", "borrowed", "was", "very", "interesting"],
    distractors: ["who", "boring"],
    grammarFocus: "relative_clauses",
    modelAudio: "The book which I borrowed was very interesting"
  },
  {
    id: "relative_4",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The woman who called you is my sister",
    options: ["sister", "my", "is", "you", "called", "who", "woman", "the", "that", "brother"],
    correctAnswer: ["The", "woman", "who", "called", "you", "is", "my", "sister"],
    distractors: ["that", "brother"],
    grammarFocus: "relative_clauses",
    modelAudio: "The woman who called you is my sister"
  },
  {
    id: "relative_5",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The restaurant where we ate was excellent",
    options: ["excellent", "was", "ate", "we", "where", "restaurant", "the", "when", "terrible"],
    correctAnswer: ["The", "restaurant", "where", "we", "ate", "was", "excellent"],
    distractors: ["when", "terrible"],
    grammarFocus: "relative_clauses",
    modelAudio: "The restaurant where we ate was excellent"
  },
  {
    id: "relative_6",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The day when we met was sunny",
    options: ["sunny", "was", "met", "we", "when", "day", "the", "where", "rainy", "cloudy"],
    correctAnswer: ["The", "day", "when", "we", "met", "was", "sunny"],
    distractors: ["where", "rainy", "cloudy"],
    grammarFocus: "relative_clauses",
    modelAudio: "The day when we met was sunny"
  },
  {
    id: "relative_7",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The car that he bought is very fast",
    options: ["fast", "very", "is", "bought", "he", "that", "car", "the", "who", "slow"],
    correctAnswer: ["The", "car", "that", "he", "bought", "is", "very", "fast"],
    distractors: ["who", "slow"],
    grammarFocus: "relative_clauses",
    modelAudio: "The car that he bought is very fast"
  },
  {
    id: "relative_8",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The house where I grew up is now a museum",
    options: ["museum", "a", "now", "is", "up", "grew", "I", "where", "house", "the", "when", "school"],
    correctAnswer: ["The", "house", "where", "I", "grew", "up", "is", "now", "a", "museum"],
    distractors: ["when", "school"],
    grammarFocus: "relative_clauses",
    modelAudio: "The house where I grew up is now a museum"
  }
];

// Level 9: Multi-clause Complex Sentences (10-11 words, 2-3 distractors)
const level9Trials: SentenceTrial[] = [
  {
    id: "multiclause_1",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "After eating breakfast we walked to the park together",
    options: ["together", "park", "the", "to", "walked", "we", "breakfast", "eating", "after", "before", "mall", "drove"],
    correctAnswer: ["After", "eating", "breakfast", "we", "walked", "to", "the", "park", "together"],
    distractors: ["before", "mall", "drove"],
    grammarFocus: "multi_clause_order",
    modelAudio: "After eating breakfast we walked to the park together"
  },
  {
    id: "multiclause_2",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "The children who were playing stopped when it started raining",
    options: ["raining", "started", "it", "when", "stopped", "playing", "were", "who", "children", "the", "adults", "snowing"],
    correctAnswer: ["The", "children", "who", "were", "playing", "stopped", "when", "it", "started", "raining"],
    distractors: ["adults", "snowing"],
    grammarFocus: "multi_clause_order",
    modelAudio: "The children who were playing stopped when it started raining"
  },
  {
    id: "multiclause_3",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "Although the weather was bad we decided to go hiking",
    options: ["hiking", "go", "to", "decided", "we", "bad", "was", "weather", "the", "although", "because", "swimming"],
    correctAnswer: ["Although", "the", "weather", "was", "bad", "we", "decided", "to", "go", "hiking"],
    distractors: ["because", "swimming"],
    grammarFocus: "multi_clause_order",
    modelAudio: "Although the weather was bad we decided to go hiking"
  },
  {
    id: "multiclause_4",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "The student who studied hard passed because she prepared well",
    options: ["well", "prepared", "she", "because", "passed", "hard", "studied", "who", "student", "the", "failed", "badly"],
    correctAnswer: ["The", "student", "who", "studied", "hard", "passed", "because", "she", "prepared", "well"],
    distractors: ["failed", "badly"],
    grammarFocus: "multi_clause_order",
    modelAudio: "The student who studied hard passed because she prepared well"
  },
  {
    id: "multiclause_5",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "Before the guests arrived she had already cleaned the house",
    options: ["house", "the", "cleaned", "already", "had", "she", "arrived", "guests", "the", "before", "after", "garage"],
    correctAnswer: ["Before", "the", "guests", "arrived", "she", "had", "already", "cleaned", "the", "house"],
    distractors: ["after", "garage"],
    grammarFocus: "multi_clause_order",
    modelAudio: "Before the guests arrived she had already cleaned the house"
  },
  {
    id: "multiclause_6",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "When I finish my work I will call you immediately",
    options: ["immediately", "you", "call", "will", "I", "work", "my", "finish", "I", "when", "before", "later"],
    correctAnswer: ["When", "I", "finish", "my", "work", "I", "will", "call", "you", "immediately"],
    distractors: ["before", "later"],
    grammarFocus: "multi_clause_order",
    modelAudio: "When I finish my work I will call you immediately"
  },
  {
    id: "multiclause_7",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "He left the party early although everyone wanted him to stay",
    options: ["stay", "to", "him", "wanted", "everyone", "although", "early", "party", "the", "left", "he", "because", "leave"],
    correctAnswer: ["He", "left", "the", "party", "early", "although", "everyone", "wanted", "him", "to", "stay"],
    distractors: ["because", "leave"],
    grammarFocus: "multi_clause_order",
    modelAudio: "He left the party early although everyone wanted him to stay"
  },
  {
    id: "multiclause_8",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "Since you helped me yesterday I will help you today",
    options: ["today", "you", "help", "will", "I", "yesterday", "me", "helped", "you", "since", "although", "tomorrow"],
    correctAnswer: ["Since", "you", "helped", "me", "yesterday", "I", "will", "help", "you", "today"],
    distractors: ["although", "tomorrow"],
    grammarFocus: "multi_clause_order",
    modelAudio: "Since you helped me yesterday I will help you today"
  }
];

// Level 10: Advanced Grammar - Passive Voice, Conditionals, Perfect Progressive (10-12 words, 3-4 distractors)
const level10Trials: SentenceTrial[] = [
  {
    id: "advanced_1",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "The cake was baked by my grandmother yesterday",
    options: ["yesterday", "grandmother", "my", "by", "baked", "was", "cake", "the", "cooked", "mother", "today"],
    correctAnswer: ["The", "cake", "was", "baked", "by", "my", "grandmother", "yesterday"],
    distractors: ["cooked", "mother", "today"],
    grammarFocus: "passive_voice",
    modelAudio: "The cake was baked by my grandmother yesterday"
  },
  {
    id: "advanced_2",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "The letter was written by the manager this morning",
    options: ["morning", "this", "manager", "the", "by", "written", "was", "letter", "the", "typed", "secretary", "afternoon"],
    correctAnswer: ["The", "letter", "was", "written", "by", "the", "manager", "this", "morning"],
    distractors: ["typed", "secretary", "afternoon"],
    grammarFocus: "passive_voice",
    modelAudio: "The letter was written by the manager this morning"
  },
  {
    id: "advanced_3",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "If it rains tomorrow we will stay inside all day",
    options: ["day", "all", "inside", "stay", "will", "we", "tomorrow", "rains", "it", "if", "when", "outside", "night"],
    correctAnswer: ["If", "it", "rains", "tomorrow", "we", "will", "stay", "inside", "all", "day"],
    distractors: ["when", "outside", "night"],
    grammarFocus: "conditionals",
    modelAudio: "If it rains tomorrow we will stay inside all day"
  },
  {
    id: "advanced_4",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "She has been waiting for three hours already",
    options: ["already", "hours", "three", "for", "waiting", "been", "has", "she", "had", "minutes", "just"],
    correctAnswer: ["She", "has", "been", "waiting", "for", "three", "hours", "already"],
    distractors: ["had", "minutes", "just"],
    grammarFocus: "perfect_progressive",
    modelAudio: "She has been waiting for three hours already"
  },
  {
    id: "advanced_5",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "The window was broken by the children playing ball",
    options: ["ball", "playing", "children", "the", "by", "broken", "was", "window", "the", "fixed", "adults", "football"],
    correctAnswer: ["The", "window", "was", "broken", "by", "the", "children", "playing", "ball"],
    distractors: ["fixed", "adults", "football"],
    grammarFocus: "passive_voice",
    modelAudio: "The window was broken by the children playing ball"
  },
  {
    id: "advanced_6",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "They have been studying English for five years now",
    options: ["now", "years", "five", "for", "English", "studying", "been", "have", "they", "had", "months", "French"],
    correctAnswer: ["They", "have", "been", "studying", "English", "for", "five", "years", "now"],
    distractors: ["had", "months", "French"],
    grammarFocus: "perfect_progressive",
    modelAudio: "They have been studying English for five years now"
  },
  {
    id: "advanced_7",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "If I had known earlier I would have helped you",
    options: ["you", "helped", "have", "would", "I", "earlier", "known", "had", "I", "if", "when", "ignored", "later"],
    correctAnswer: ["If", "I", "had", "known", "earlier", "I", "would", "have", "helped", "you"],
    distractors: ["when", "ignored", "later"],
    grammarFocus: "conditionals",
    modelAudio: "If I had known earlier I would have helped you"
  },
  {
    id: "advanced_8",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "The report will be finished by the end of the week",
    options: ["week", "the", "of", "end", "the", "by", "finished", "be", "will", "report", "the", "started", "month", "day"],
    correctAnswer: ["The", "report", "will", "be", "finished", "by", "the", "end", "of", "the", "week"],
    distractors: ["started", "month", "day"],
    grammarFocus: "passive_voice",
    modelAudio: "The report will be finished by the end of the week"
  }
];

// =====================================================================
// Phase 2 expansion (Wave 2): +12 trials per difficulty d4–d10 to lift
// every implemented engine tier from 8 → 20. Schema matches the existing
// levelNTrials arrays above. No engine/bridge/level-spec changes.
// =====================================================================

const level4ExtraTrials: SentenceTrial[] = [
  { id: "prep_9",  taskType: "sentence_reorder", difficulty: 4, targetSentence: "The cat sleeps on the chair",      options: ["chair","the","on","sleeps","cat","the","under"],           correctAnswer: ["The","cat","sleeps","on","the","chair"],            distractors: ["under"],   grammarFocus: "prepositional_phrase",  modelAudio: "The cat sleeps on the chair" },
  { id: "prep_10", taskType: "sentence_reorder", difficulty: 4, targetSentence: "He drives to work each day",        options: ["day","each","work","to","drives","he","night"],            correctAnswer: ["He","drives","to","work","each","day"],             distractors: ["night"],   grammarFocus: "word_order_complex",    modelAudio: "He drives to work each day" },
  { id: "prep_11", taskType: "sentence_reorder", difficulty: 4, targetSentence: "The keys are in the drawer",        options: ["drawer","the","in","are","keys","the","on"],               correctAnswer: ["The","keys","are","in","the","drawer"],             distractors: ["on"],      grammarFocus: "prepositional_phrase",  modelAudio: "The keys are in the drawer" },
  { id: "prep_12", taskType: "sentence_reorder", difficulty: 4, targetSentence: "She sent a letter to her friend",   options: ["friend","her","to","letter","a","sent","she","him"],       correctAnswer: ["She","sent","a","letter","to","her","friend"],      distractors: ["him"],     grammarFocus: "ditransitive",          modelAudio: "She sent a letter to her friend" },
  { id: "prep_13", taskType: "sentence_reorder", difficulty: 4, targetSentence: "The book is on the shelf",          options: ["shelf","the","on","is","book","the","under"],              correctAnswer: ["The","book","is","on","the","shelf"],               distractors: ["under"],   grammarFocus: "prepositional_phrase",  modelAudio: "The book is on the shelf" },
  { id: "prep_14", taskType: "sentence_reorder", difficulty: 4, targetSentence: "We went to the beach last summer",  options: ["summer","last","beach","the","to","went","we","next"],     correctAnswer: ["We","went","to","the","beach","last","summer"],     distractors: ["next"],    grammarFocus: "word_order_complex",    modelAudio: "We went to the beach last summer" },
  { id: "prep_15", taskType: "sentence_reorder", difficulty: 4, targetSentence: "The dog runs across the yard",      options: ["yard","the","across","runs","dog","the","around"],         correctAnswer: ["The","dog","runs","across","the","yard"],           distractors: ["around"],  grammarFocus: "prepositional_phrase",  modelAudio: "The dog runs across the yard" },
  { id: "prep_16", taskType: "sentence_reorder", difficulty: 4, targetSentence: "She gave the gift to him",          options: ["him","to","gift","the","gave","she","her"],                correctAnswer: ["She","gave","the","gift","to","him"],               distractors: ["her"],     grammarFocus: "ditransitive",          modelAudio: "She gave the gift to him" },
  { id: "prep_17", taskType: "sentence_reorder", difficulty: 4, targetSentence: "The plane lands at the airport",    options: ["airport","the","at","lands","plane","the","near"],         correctAnswer: ["The","plane","lands","at","the","airport"],         distractors: ["near"],    grammarFocus: "prepositional_phrase",  modelAudio: "The plane lands at the airport" },
  { id: "prep_18", taskType: "sentence_reorder", difficulty: 4, targetSentence: "I drink coffee every morning",      options: ["morning","every","coffee","drink","I","night"],            correctAnswer: ["I","drink","coffee","every","morning"],             distractors: ["night"],   grammarFocus: "word_order_complex",    modelAudio: "I drink coffee every morning" },
  { id: "prep_19", taskType: "sentence_reorder", difficulty: 4, targetSentence: "He sat next to his sister",         options: ["sister","his","to","next","sat","he","brother"],           correctAnswer: ["He","sat","next","to","his","sister"],              distractors: ["brother"], grammarFocus: "prepositional_phrase",  modelAudio: "He sat next to his sister" },
  { id: "prep_20", taskType: "sentence_reorder", difficulty: 4, targetSentence: "They played in the garden",         options: ["garden","the","in","played","they","outside"],             correctAnswer: ["They","played","in","the","garden"],                distractors: ["outside"], grammarFocus: "prepositional_phrase",  modelAudio: "They played in the garden" },
];

const level5ExtraTrials: SentenceTrial[] = [
  { id: "past_9",  taskType: "sentence_reorder", difficulty: 5, targetSentence: "He walked the dog this morning",       options: ["morning","this","dog","the","walked","he","walks","evening"],         correctAnswer: ["He","walked","the","dog","this","morning"],        distractors: ["walks","evening"],   grammarFocus: "past_tense",          modelAudio: "He walked the dog this morning" },
  { id: "past_10", taskType: "sentence_reorder", difficulty: 5, targetSentence: "She was reading a book quietly",        options: ["quietly","book","a","reading","was","she","were","loudly"],           correctAnswer: ["She","was","reading","a","book","quietly"],        distractors: ["were","loudly"],     grammarFocus: "past_progressive",    modelAudio: "She was reading a book quietly" },
  { id: "past_11", taskType: "sentence_reorder", difficulty: 5, targetSentence: "We have visited that museum before",    options: ["before","museum","that","visited","have","we","has","never"],         correctAnswer: ["We","have","visited","that","museum","before"],    distractors: ["has","never"],       grammarFocus: "present_perfect",     modelAudio: "We have visited that museum before" },
  { id: "past_12", taskType: "sentence_reorder", difficulty: 5, targetSentence: "The boys are running in the field",     options: ["field","the","in","running","are","boys","the","is","walking"],       correctAnswer: ["The","boys","are","running","in","the","field"],   distractors: ["is","walking"],      grammarFocus: "present_progressive", modelAudio: "The boys are running in the field" },
  { id: "past_13", taskType: "sentence_reorder", difficulty: 5, targetSentence: "I baked a cake last night",             options: ["night","last","cake","a","baked","I","bakes","tomorrow"],             correctAnswer: ["I","baked","a","cake","last","night"],             distractors: ["bakes","tomorrow"],  grammarFocus: "past_tense",          modelAudio: "I baked a cake last night" },
  { id: "past_14", taskType: "sentence_reorder", difficulty: 5, targetSentence: "They were singing when I entered",      options: ["entered","I","when","singing","were","they","was","dancing"],         correctAnswer: ["They","were","singing","when","I","entered"],      distractors: ["was","dancing"],     grammarFocus: "past_progressive",    modelAudio: "They were singing when I entered" },
  { id: "past_15", taskType: "sentence_reorder", difficulty: 5, targetSentence: "She has written three letters today",   options: ["today","letters","three","written","has","she","have","yesterday"],   correctAnswer: ["She","has","written","three","letters","today"],   distractors: ["have","yesterday"],  grammarFocus: "present_perfect",     modelAudio: "She has written three letters today" },
  { id: "past_16", taskType: "sentence_reorder", difficulty: 5, targetSentence: "He is fixing the car right now",        options: ["now","right","car","the","fixing","is","he","are","breaking"],        correctAnswer: ["He","is","fixing","the","car","right","now"],      distractors: ["are","breaking"],    grammarFocus: "present_progressive", modelAudio: "He is fixing the car right now" },
  { id: "past_17", taskType: "sentence_reorder", difficulty: 5, targetSentence: "We watched a movie last weekend",       options: ["weekend","last","movie","a","watched","we","watch","next"],           correctAnswer: ["We","watched","a","movie","last","weekend"],       distractors: ["watch","next"],      grammarFocus: "past_tense",          modelAudio: "We watched a movie last weekend" },
  { id: "past_18", taskType: "sentence_reorder", difficulty: 5, targetSentence: "She was cooking dinner all afternoon",  options: ["afternoon","all","dinner","cooking","was","she","were","morning"],    correctAnswer: ["She","was","cooking","dinner","all","afternoon"], distractors: ["were","morning"],    grammarFocus: "past_progressive",    modelAudio: "She was cooking dinner all afternoon" },
  { id: "past_19", taskType: "sentence_reorder", difficulty: 5, targetSentence: "They have finished their project",      options: ["project","their","finished","have","they","has","started"],           correctAnswer: ["They","have","finished","their","project"],        distractors: ["has","started"],     grammarFocus: "present_perfect",     modelAudio: "They have finished their project" },
  { id: "past_20", taskType: "sentence_reorder", difficulty: 5, targetSentence: "I called my mother yesterday evening",  options: ["evening","yesterday","mother","my","called","I","calls","tomorrow"],  correctAnswer: ["I","called","my","mother","yesterday","evening"], distractors: ["calls","tomorrow"],  grammarFocus: "past_tense",          modelAudio: "I called my mother yesterday evening" },
];

const level6ExtraTrials: SentenceTrial[] = [
  { id: "compound_9",  taskType: "sentence_reorder", difficulty: 6, targetSentence: "She made dinner and he washed the dishes",   options: ["dishes","the","washed","he","and","dinner","made","she","or","dried"],       correctAnswer: ["She","made","dinner","and","he","washed","the","dishes"],     distractors: ["or","dried"],     grammarFocus: "coordinating_conjunctions", modelAudio: "She made dinner and he washed the dishes" },
  { id: "compound_10", taskType: "sentence_reorder", difficulty: 6, targetSentence: "I was hungry so I made a sandwich",          options: ["sandwich","a","made","I","so","hungry","was","I","but","tired"],             correctAnswer: ["I","was","hungry","so","I","made","a","sandwich"],            distractors: ["but","tired"],    grammarFocus: "coordinating_conjunctions", modelAudio: "I was hungry so I made a sandwich" },
  { id: "compound_11", taskType: "sentence_reorder", difficulty: 6, targetSentence: "The sun rose and the birds began singing",   options: ["singing","began","birds","the","and","rose","sun","the","or","stopped"],     correctAnswer: ["The","sun","rose","and","the","birds","began","singing"],     distractors: ["or","stopped"],   grammarFocus: "coordinating_conjunctions", modelAudio: "The sun rose and the birds began singing" },
  { id: "compound_12", taskType: "sentence_reorder", difficulty: 6, targetSentence: "He wanted to help but he was busy",          options: ["busy","was","he","but","help","to","wanted","he","and","free"],              correctAnswer: ["He","wanted","to","help","but","he","was","busy"],            distractors: ["and","free"],     grammarFocus: "coordinating_conjunctions", modelAudio: "He wanted to help but he was busy" },
  { id: "compound_13", taskType: "sentence_reorder", difficulty: 6, targetSentence: "You can drive or you can take the bus",      options: ["bus","the","take","can","you","or","drive","can","you","and","walk"],        correctAnswer: ["You","can","drive","or","you","can","take","the","bus"],      distractors: ["and","walk"],     grammarFocus: "coordinating_conjunctions", modelAudio: "You can drive or you can take the bus" },
  { id: "compound_14", taskType: "sentence_reorder", difficulty: 6, targetSentence: "It was raining so we stayed home",           options: ["home","stayed","we","so","raining","was","it","but","left"],                 correctAnswer: ["It","was","raining","so","we","stayed","home"],               distractors: ["but","left"],     grammarFocus: "coordinating_conjunctions", modelAudio: "It was raining so we stayed home" },
  { id: "compound_15", taskType: "sentence_reorder", difficulty: 6, targetSentence: "The food was cold and the service was slow", options: ["slow","was","service","the","and","cold","was","food","the","but","fast"],   correctAnswer: ["The","food","was","cold","and","the","service","was","slow"], distractors: ["but","fast"],     grammarFocus: "coordinating_conjunctions", modelAudio: "The food was cold and the service was slow" },
  { id: "compound_16", taskType: "sentence_reorder", difficulty: 6, targetSentence: "We can eat now or we can wait",              options: ["wait","can","we","or","now","eat","can","we","and","sleep"],                 correctAnswer: ["We","can","eat","now","or","we","can","wait"],                distractors: ["and","sleep"],    grammarFocus: "coordinating_conjunctions", modelAudio: "We can eat now or we can wait" },
  { id: "compound_17", taskType: "sentence_reorder", difficulty: 6, targetSentence: "She was tired so she went to bed",           options: ["bed","to","went","she","so","tired","was","she","but","awake"],              correctAnswer: ["She","was","tired","so","she","went","to","bed"],             distractors: ["but","awake"],    grammarFocus: "coordinating_conjunctions", modelAudio: "She was tired so she went to bed" },
  { id: "compound_18", taskType: "sentence_reorder", difficulty: 6, targetSentence: "He opened the door and walked outside",      options: ["outside","walked","and","door","the","opened","he","or","closed"],           correctAnswer: ["He","opened","the","door","and","walked","outside"],          distractors: ["or","closed"],    grammarFocus: "coordinating_conjunctions", modelAudio: "He opened the door and walked outside" },
  { id: "compound_19", taskType: "sentence_reorder", difficulty: 6, targetSentence: "I like tea but I prefer coffee",             options: ["coffee","prefer","I","but","tea","like","I","and","hate"],                   correctAnswer: ["I","like","tea","but","I","prefer","coffee"],                 distractors: ["and","hate"],     grammarFocus: "coordinating_conjunctions", modelAudio: "I like tea but I prefer coffee" },
  { id: "compound_20", taskType: "sentence_reorder", difficulty: 6, targetSentence: "The phone rang and she answered it",         options: ["it","answered","she","and","rang","phone","the","or","ignored"],             correctAnswer: ["The","phone","rang","and","she","answered","it"],             distractors: ["or","ignored"],   grammarFocus: "coordinating_conjunctions", modelAudio: "The phone rang and she answered it" },
];

const level7ExtraTrials: SentenceTrial[] = [
  { id: "subordinate_9",  taskType: "sentence_reorder", difficulty: 7, targetSentence: "Because she was late she missed the bus",        options: ["bus","the","missed","she","late","was","she","because","although","train"],       correctAnswer: ["Because","she","was","late","she","missed","the","bus"],       distractors: ["although","train"],  grammarFocus: "subordinating_conjunctions", modelAudio: "Because she was late she missed the bus" },
  { id: "subordinate_10", taskType: "sentence_reorder", difficulty: 7, targetSentence: "When the bell rang the students stood up",       options: ["up","stood","students","the","rang","bell","the","when","before","sat"],          correctAnswer: ["When","the","bell","rang","the","students","stood","up"],      distractors: ["before","sat"],      grammarFocus: "subordinating_conjunctions", modelAudio: "When the bell rang the students stood up" },
  { id: "subordinate_11", taskType: "sentence_reorder", difficulty: 7, targetSentence: "Although it was cold we went outside",           options: ["outside","went","we","cold","was","it","although","because","inside"],            correctAnswer: ["Although","it","was","cold","we","went","outside"],            distractors: ["because","inside"],  grammarFocus: "subordinating_conjunctions", modelAudio: "Although it was cold we went outside" },
  { id: "subordinate_12", taskType: "sentence_reorder", difficulty: 7, targetSentence: "If you are hungry eat some fruit",               options: ["fruit","some","eat","hungry","are","you","if","when","bread"],                    correctAnswer: ["If","you","are","hungry","eat","some","fruit"],                distractors: ["when","bread"],      grammarFocus: "subordinating_conjunctions", modelAudio: "If you are hungry eat some fruit" },
  { id: "subordinate_13", taskType: "sentence_reorder", difficulty: 7, targetSentence: "While she was sleeping the cat jumped down",     options: ["down","jumped","cat","the","sleeping","was","she","while","after","climbed"],     correctAnswer: ["While","she","was","sleeping","the","cat","jumped","down"],    distractors: ["after","climbed"],   grammarFocus: "subordinating_conjunctions", modelAudio: "While she was sleeping the cat jumped down" },
  { id: "subordinate_14", taskType: "sentence_reorder", difficulty: 7, targetSentence: "He smiled because the news was good",            options: ["good","was","news","the","because","smiled","he","although","bad"],               correctAnswer: ["He","smiled","because","the","news","was","good"],             distractors: ["although","bad"],    grammarFocus: "subordinating_conjunctions", modelAudio: "He smiled because the news was good" },
  { id: "subordinate_15", taskType: "sentence_reorder", difficulty: 7, targetSentence: "Before we eat please wash your hands",           options: ["hands","your","wash","please","eat","we","before","after","feet"],                correctAnswer: ["Before","we","eat","please","wash","your","hands"],            distractors: ["after","feet"],      grammarFocus: "subordinating_conjunctions", modelAudio: "Before we eat please wash your hands" },
  { id: "subordinate_16", taskType: "sentence_reorder", difficulty: 7, targetSentence: "After the rain stopped we went for a walk",     options: ["walk","a","for","went","we","stopped","rain","the","after","before","run"],       correctAnswer: ["After","the","rain","stopped","we","went","for","a","walk"],   distractors: ["before","run"],      grammarFocus: "subordinating_conjunctions", modelAudio: "After the rain stopped we went for a walk" },
  { id: "subordinate_17", taskType: "sentence_reorder", difficulty: 7, targetSentence: "Since you are tired you should rest",            options: ["rest","should","you","tired","are","you","since","because","work"],               correctAnswer: ["Since","you","are","tired","you","should","rest"],             distractors: ["because","work"],    grammarFocus: "subordinating_conjunctions", modelAudio: "Since you are tired you should rest" },
  { id: "subordinate_18", taskType: "sentence_reorder", difficulty: 7, targetSentence: "Unless it rains we will play outside",           options: ["outside","play","will","we","rains","it","unless","if","inside"],                 correctAnswer: ["Unless","it","rains","we","will","play","outside"],            distractors: ["if","inside"],       grammarFocus: "subordinating_conjunctions", modelAudio: "Unless it rains we will play outside" },
  { id: "subordinate_19", taskType: "sentence_reorder", difficulty: 7, targetSentence: "When the game ended the fans cheered loudly",    options: ["loudly","cheered","fans","the","ended","game","the","when","before","quietly"],   correctAnswer: ["When","the","game","ended","the","fans","cheered","loudly"],   distractors: ["before","quietly"],  grammarFocus: "subordinating_conjunctions", modelAudio: "When the game ended the fans cheered loudly" },
  { id: "subordinate_20", taskType: "sentence_reorder", difficulty: 7, targetSentence: "Although he tried hard he did not win",          options: ["win","not","did","he","hard","tried","he","although","because","lose"],           correctAnswer: ["Although","he","tried","hard","he","did","not","win"],         distractors: ["because","lose"],    grammarFocus: "subordinating_conjunctions", modelAudio: "Although he tried hard he did not win" },
];

const level8ExtraTrials: SentenceTrial[] = [
  { id: "relative_9",  taskType: "sentence_reorder", difficulty: 8, targetSentence: "The teacher who taught me retired last year",    options: ["year","last","retired","me","taught","who","teacher","the","which","started"],   correctAnswer: ["The","teacher","who","taught","me","retired","last","year"], distractors: ["which","started"],  grammarFocus: "relative_clauses", modelAudio: "The teacher who taught me retired last year" },
  { id: "relative_10", taskType: "sentence_reorder", difficulty: 8, targetSentence: "I found the keys that you lost",                 options: ["lost","you","that","keys","the","found","I","which","kept"],                     correctAnswer: ["I","found","the","keys","that","you","lost"],                distractors: ["which","kept"],     grammarFocus: "relative_clauses", modelAudio: "I found the keys that you lost" },
  { id: "relative_11", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The song which she sang was beautiful",          options: ["beautiful","was","sang","she","which","song","the","who","ugly"],                correctAnswer: ["The","song","which","she","sang","was","beautiful"],         distractors: ["who","ugly"],       grammarFocus: "relative_clauses", modelAudio: "The song which she sang was beautiful" },
  { id: "relative_12", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The boy who broke the window apologized",        options: ["apologized","window","the","broke","who","boy","the","which","ignored"],         correctAnswer: ["The","boy","who","broke","the","window","apologized"],       distractors: ["which","ignored"],  grammarFocus: "relative_clauses", modelAudio: "The boy who broke the window apologized" },
  { id: "relative_13", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The park where we played is closed",             options: ["closed","is","played","we","where","park","the","when","open"],                  correctAnswer: ["The","park","where","we","played","is","closed"],            distractors: ["when","open"],      grammarFocus: "relative_clauses", modelAudio: "The park where we played is closed" },
  { id: "relative_14", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The year when I graduated was special",          options: ["special","was","graduated","I","when","year","the","where","ordinary"],          correctAnswer: ["The","year","when","I","graduated","was","special"],         distractors: ["where","ordinary"], grammarFocus: "relative_clauses", modelAudio: "The year when I graduated was special" },
  { id: "relative_15", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The bike that I bought is red",                  options: ["red","is","bought","I","that","bike","the","who","blue"],                        correctAnswer: ["The","bike","that","I","bought","is","red"],                 distractors: ["who","blue"],       grammarFocus: "relative_clauses", modelAudio: "The bike that I bought is red" },
  { id: "relative_16", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The cafe where we met has closed down",          options: ["down","closed","has","met","we","where","cafe","the","when","opened"],           correctAnswer: ["The","cafe","where","we","met","has","closed","down"],       distractors: ["when","opened"],    grammarFocus: "relative_clauses", modelAudio: "The cafe where we met has closed down" },
  { id: "relative_17", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The girl who won the prize smiled brightly",     options: ["brightly","smiled","prize","the","won","who","girl","the","which","cried"],      correctAnswer: ["The","girl","who","won","the","prize","smiled","brightly"],  distractors: ["which","cried"],    grammarFocus: "relative_clauses", modelAudio: "The girl who won the prize smiled brightly" },
  { id: "relative_18", taskType: "sentence_reorder", difficulty: 8, targetSentence: "I met the author whose book I love",             options: ["love","I","book","whose","author","the","met","I","which","hate"],               correctAnswer: ["I","met","the","author","whose","book","I","love"],          distractors: ["which","hate"],     grammarFocus: "relative_clauses", modelAudio: "I met the author whose book I love" },
  { id: "relative_19", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The hotel where we stayed was very clean",       options: ["clean","very","was","stayed","we","where","hotel","the","when","dirty"],         correctAnswer: ["The","hotel","where","we","stayed","was","very","clean"],    distractors: ["when","dirty"],     grammarFocus: "relative_clauses", modelAudio: "The hotel where we stayed was very clean" },
  { id: "relative_20", taskType: "sentence_reorder", difficulty: 8, targetSentence: "The painting that hangs there is famous",        options: ["famous","is","there","hangs","that","painting","the","who","unknown"],           correctAnswer: ["The","painting","that","hangs","there","is","famous"],       distractors: ["who","unknown"],    grammarFocus: "relative_clauses", modelAudio: "The painting that hangs there is famous" },
];

const level9ExtraTrials: SentenceTrial[] = [
  { id: "multiclause_9",  taskType: "sentence_reorder", difficulty: 9, targetSentence: "After we finished dinner we watched a movie together",      options: ["together","movie","a","watched","we","dinner","finished","we","after","before","game","skipped"], correctAnswer: ["After","we","finished","dinner","we","watched","a","movie","together"],       distractors: ["before","game","skipped"], grammarFocus: "multi_clause_order", modelAudio: "After we finished dinner we watched a movie together" },
  { id: "multiclause_10", taskType: "sentence_reorder", difficulty: 9, targetSentence: "The man who fixed the car charged us fairly",               options: ["fairly","us","charged","car","the","fixed","who","man","the","which","unfairly"],                correctAnswer: ["The","man","who","fixed","the","car","charged","us","fairly"],                distractors: ["which","unfairly"],        grammarFocus: "multi_clause_order", modelAudio: "The man who fixed the car charged us fairly" },
  { id: "multiclause_11", taskType: "sentence_reorder", difficulty: 9, targetSentence: "Although she was tired she finished her homework carefully",options: ["carefully","homework","her","finished","she","tired","was","she","although","because","quickly"], correctAnswer: ["Although","she","was","tired","she","finished","her","homework","carefully"], distractors: ["because","quickly"],       grammarFocus: "multi_clause_order", modelAudio: "Although she was tired she finished her homework carefully" },
  { id: "multiclause_12", taskType: "sentence_reorder", difficulty: 9, targetSentence: "The dog that barked loudly woke up the neighbors",          options: ["neighbors","the","up","woke","loudly","barked","that","dog","the","which","quietly"],            correctAnswer: ["The","dog","that","barked","loudly","woke","up","the","neighbors"],           distractors: ["which","quietly"],         grammarFocus: "multi_clause_order", modelAudio: "The dog that barked loudly woke up the neighbors" },
  { id: "multiclause_13", taskType: "sentence_reorder", difficulty: 9, targetSentence: "When the lights went out we lit some candles quickly",      options: ["quickly","candles","some","lit","we","out","went","lights","the","when","before","slowly"],      correctAnswer: ["When","the","lights","went","out","we","lit","some","candles","quickly"],     distractors: ["before","slowly"],         grammarFocus: "multi_clause_order", modelAudio: "When the lights went out we lit some candles quickly" },
  { id: "multiclause_14", taskType: "sentence_reorder", difficulty: 9, targetSentence: "Because the road was closed we took a different route",    options: ["route","different","a","took","we","closed","was","road","the","because","although","same"],     correctAnswer: ["Because","the","road","was","closed","we","took","a","different","route"],    distractors: ["although","same"],         grammarFocus: "multi_clause_order", modelAudio: "Because the road was closed we took a different route" },
  { id: "multiclause_15", taskType: "sentence_reorder", difficulty: 9, targetSentence: "The woman who called earlier left a message for you",       options: ["you","for","message","a","left","earlier","called","who","woman","the","which","note"],          correctAnswer: ["The","woman","who","called","earlier","left","a","message","for","you"],      distractors: ["which","note"],            grammarFocus: "multi_clause_order", modelAudio: "The woman who called earlier left a message for you" },
  { id: "multiclause_16", taskType: "sentence_reorder", difficulty: 9, targetSentence: "Before the show started we found our seats together",      options: ["together","seats","our","found","we","started","show","the","before","after","apart"],           correctAnswer: ["Before","the","show","started","we","found","our","seats","together"],        distractors: ["after","apart"],           grammarFocus: "multi_clause_order", modelAudio: "Before the show started we found our seats together" },
  { id: "multiclause_17", taskType: "sentence_reorder", difficulty: 9, targetSentence: "While we were eating dinner the doorbell rang twice",      options: ["twice","rang","doorbell","the","dinner","eating","were","we","while","after","once"],            correctAnswer: ["While","we","were","eating","dinner","the","doorbell","rang","twice"],        distractors: ["after","once"],            grammarFocus: "multi_clause_order", modelAudio: "While we were eating dinner the doorbell rang twice" },
  { id: "multiclause_18", taskType: "sentence_reorder", difficulty: 9, targetSentence: "The book that he gave me changed my life completely",       options: ["completely","life","my","changed","me","gave","he","that","book","the","which","slightly"],       correctAnswer: ["The","book","that","he","gave","me","changed","my","life","completely"],      distractors: ["which","slightly"],        grammarFocus: "multi_clause_order", modelAudio: "The book that he gave me changed my life completely" },
  { id: "multiclause_19", taskType: "sentence_reorder", difficulty: 9, targetSentence: "After the meeting ended we walked back to the office",     options: ["office","the","to","back","walked","we","ended","meeting","the","after","before","ran"],         correctAnswer: ["After","the","meeting","ended","we","walked","back","to","the","office"],     distractors: ["before","ran"],            grammarFocus: "multi_clause_order", modelAudio: "After the meeting ended we walked back to the office" },
  { id: "multiclause_20", taskType: "sentence_reorder", difficulty: 9, targetSentence: "Although the test was hard she answered every question",   options: ["question","every","answered","she","hard","was","test","the","although","because","skipped"],    correctAnswer: ["Although","the","test","was","hard","she","answered","every","question"],     distractors: ["because","skipped"],       grammarFocus: "multi_clause_order", modelAudio: "Although the test was hard she answered every question" },
];

const level10ExtraTrials: SentenceTrial[] = [
  { id: "advanced_9",  taskType: "sentence_reorder", difficulty: 10, targetSentence: "The bridge was built by engineers many years ago",        options: ["ago","years","many","engineers","by","built","was","bridge","the","destroyed","workers","recently"], correctAnswer: ["The","bridge","was","built","by","engineers","many","years","ago"],         distractors: ["destroyed","workers","recently"], grammarFocus: "passive_voice",       modelAudio: "The bridge was built by engineers many years ago" },
  { id: "advanced_10", taskType: "sentence_reorder", difficulty: 10, targetSentence: "If you had called we would have come over",                options: ["over","come","have","would","we","called","had","you","if","when","stayed","later"],                 correctAnswer: ["If","you","had","called","we","would","have","come","over"],                distractors: ["when","stayed","later"],          grammarFocus: "conditionals",        modelAudio: "If you had called we would have come over" },
  { id: "advanced_11", taskType: "sentence_reorder", difficulty: 10, targetSentence: "He has been working here for ten years now",               options: ["now","years","ten","for","here","working","been","has","he","had","months","there"],                 correctAnswer: ["He","has","been","working","here","for","ten","years","now"],               distractors: ["had","months","there"],           grammarFocus: "perfect_progressive", modelAudio: "He has been working here for ten years now" },
  { id: "advanced_12", taskType: "sentence_reorder", difficulty: 10, targetSentence: "The package was delivered by the courier this afternoon",  options: ["afternoon","this","courier","the","by","delivered","was","package","the","mailed","driver","morning"], correctAnswer: ["The","package","was","delivered","by","the","courier","this","afternoon"], distractors: ["mailed","driver","morning"],      grammarFocus: "passive_voice",       modelAudio: "The package was delivered by the courier this afternoon" },
  { id: "advanced_13", taskType: "sentence_reorder", difficulty: 10, targetSentence: "If she studies harder she will pass the exam",             options: ["exam","the","pass","will","she","harder","studies","she","if","when","fail","later"],                correctAnswer: ["If","she","studies","harder","she","will","pass","the","exam"],             distractors: ["when","fail","later"],            grammarFocus: "conditionals",        modelAudio: "If she studies harder she will pass the exam" },
  { id: "advanced_14", taskType: "sentence_reorder", difficulty: 10, targetSentence: "They had been driving for hours before they stopped",      options: ["stopped","they","before","hours","for","driving","been","had","they","have","minutes","started"],     correctAnswer: ["They","had","been","driving","for","hours","before","they","stopped"],      distractors: ["have","minutes","started"],       grammarFocus: "perfect_progressive", modelAudio: "They had been driving for hours before they stopped" },
  { id: "advanced_15", taskType: "sentence_reorder", difficulty: 10, targetSentence: "The song was recorded by the band last summer",            options: ["summer","last","band","the","by","recorded","was","song","the","performed","singer","winter"],       correctAnswer: ["The","song","was","recorded","by","the","band","last","summer"],            distractors: ["performed","singer","winter"],    grammarFocus: "passive_voice",       modelAudio: "The song was recorded by the band last summer" },
  { id: "advanced_16", taskType: "sentence_reorder", difficulty: 10, targetSentence: "If we leave now we will arrive on time",                   options: ["time","on","arrive","will","we","now","leave","we","if","when","late","later"],                       correctAnswer: ["If","we","leave","now","we","will","arrive","on","time"],                   distractors: ["when","late","later"],            grammarFocus: "conditionals",        modelAudio: "If we leave now we will arrive on time" },
  { id: "advanced_17", taskType: "sentence_reorder", difficulty: 10, targetSentence: "She has been teaching at the school since September",      options: ["September","since","school","the","at","teaching","been","has","she","had","university","October"],   correctAnswer: ["She","has","been","teaching","at","the","school","since","September"],      distractors: ["had","university","October"],     grammarFocus: "perfect_progressive", modelAudio: "She has been teaching at the school since September" },
  { id: "advanced_18", taskType: "sentence_reorder", difficulty: 10, targetSentence: "The car was washed by my brother last weekend",            options: ["weekend","last","brother","my","by","washed","was","car","the","cleaned","sister","week"],            correctAnswer: ["The","car","was","washed","by","my","brother","last","weekend"],            distractors: ["cleaned","sister","week"],        grammarFocus: "passive_voice",       modelAudio: "The car was washed by my brother last weekend" },
  { id: "advanced_19", taskType: "sentence_reorder", difficulty: 10, targetSentence: "If they had left earlier they would not be late",          options: ["late","be","not","would","they","earlier","left","had","they","if","when","early","arrived"],         correctAnswer: ["If","they","had","left","earlier","they","would","not","be","late"],        distractors: ["when","early","arrived"],         grammarFocus: "conditionals",        modelAudio: "If they had left earlier they would not be late" },
  { id: "advanced_20", taskType: "sentence_reorder", difficulty: 10, targetSentence: "We have been waiting for the bus since morning",           options: ["morning","since","bus","the","for","waiting","been","have","we","had","train","evening"],             correctAnswer: ["We","have","been","waiting","for","the","bus","since","morning"],           distractors: ["had","train","evening"],          grammarFocus: "perfect_progressive", modelAudio: "We have been waiting for the bus since morning" },
];

export const SENTENCE_TRIALS = [
  ...level1Trials,
  ...level2Trials,
  ...level3Trials,
  ...level4Trials,
  ...level4ExtraTrials,
  ...level5Trials,
  ...level5ExtraTrials,
  ...level6Trials,
  ...level6ExtraTrials,
  ...level7Trials,
  ...level7ExtraTrials,
  ...level8Trials,
  ...level8ExtraTrials,
  ...level9Trials,
  ...level9ExtraTrials,
  ...level10Trials,
  ...level10ExtraTrials,
];

export const getTrialsForDifficulty = (level: number): SentenceTrial[] => {
  return SENTENCE_TRIALS.filter(t => t.difficulty === level);
};

export const getMixedTrials = (level: number, count: number = 10): SentenceTrial[] => {
  const levelTrials = getTrialsForDifficulty(level);
  const shuffled = [...levelTrials].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const analyzeSentenceErrors = (
  trial: SentenceTrial,
  userAnswer: string[]
): {
  errorType: GrammarErrorType | null;
  incorrectPosition?: number;
  explanation: string;
  usedDistractor?: string;
} => {
  const correct = trial.correctAnswer;
  
  // Check if user included any distractors
  const distractorsLower = trial.distractors.map(d => d.toLowerCase());
  const usedDistractor = userAnswer.find(word => 
    distractorsLower.includes(word.toLowerCase())
  );
  
  if (usedDistractor) {
    return {
      errorType: "extra_word_selected",
      explanation: `"${usedDistractor}" should not be in the sentence`,
      usedDistractor
    };
  }
  
  // Check word order
  for (let i = 0; i < Math.max(correct.length, userAnswer.length); i++) {
    const correctWord = correct[i]?.toLowerCase();
    const userWord = userAnswer[i]?.toLowerCase();
    
    if (!userWord && correctWord) {
      return {
        errorType: "missing_word",
        incorrectPosition: i,
        explanation: `Missing word at position ${i + 1}`
      };
    }
    
    if (correctWord !== userWord) {
      // Determine specific error type based on grammar focus
      if (trial.grammarFocus.includes("agreement") || trial.grammarFocus.includes("singular") || trial.grammarFocus.includes("plural")) {
        return {
          errorType: "agreement_error",
          incorrectPosition: i,
          explanation: "Subject-verb agreement error"
        };
      } else if (trial.grammarFocus.includes("tense") || trial.grammarFocus.includes("progressive") || trial.grammarFocus.includes("perfect")) {
        return {
          errorType: "tense_error",
          incorrectPosition: i,
          explanation: "Verb tense error"
        };
      } else if (trial.grammarFocus.includes("passive")) {
        return {
          errorType: "passive_voice_error",
          incorrectPosition: i,
          explanation: "Passive voice structure error"
        };
      } else if (trial.grammarFocus.includes("conjunction")) {
        return {
          errorType: "conjunction_error",
          incorrectPosition: i,
          explanation: "Conjunction error"
        };
      } else if (trial.grammarFocus.includes("relative")) {
        return {
          errorType: "relative_clause_error",
          incorrectPosition: i,
          explanation: "Relative pronoun error"
        };
      } else if (trial.grammarFocus.includes("clause") || trial.grammarFocus.includes("order")) {
        return {
          errorType: "clause_order_error",
          incorrectPosition: i,
          explanation: "Clause order error"
        };
      }
      
      return {
        errorType: "word_order",
        incorrectPosition: i,
        explanation: `Word order error at position ${i + 1}`
      };
    }
  }
  
  return {
    errorType: null,
    explanation: "Correct"
  };
};
