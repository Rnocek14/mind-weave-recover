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

export const SENTENCE_TRIALS = [
  ...level1Trials,
  ...level2Trials,
  ...level3Trials,
  ...level4Trials,
  ...level5Trials,
  ...level6Trials,
  ...level7Trials,
  ...level8Trials,
  ...level9Trials,
  ...level10Trials
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
