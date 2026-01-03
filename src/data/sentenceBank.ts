export type SentenceTaskType = 
  | "word_order" 
  | "fill_function" 
  | "verb_agreement" 
  | "sentence_reorder" 
  | "cloze_picture";

export type GrammarErrorType = 
  | "word_order" 
  | "function_word_omission" 
  | "verb_inflection" 
  | "tense_error"
  | "agreement_error"
  | "conjunction_error"
  | "clause_order_error"
  | "relative_clause_error"
  | "passive_voice_error";

export interface SentenceTrial {
  id: string;
  taskType: SentenceTaskType;
  difficulty: number; // 1-5
  imagePrompt?: string; // path to image if needed
  targetSentence: string; // correct answer
  scrambledWords?: string[]; // for word_order/sentence_reorder
  sentenceTemplate?: string; // for fill_function/cloze (with ___ blanks)
  options: string[]; // word options to choose from
  correctAnswer: string | string[]; // single word or ordered array
  distractors: string[]; // incorrect options
  grammarFocus: string; // e.g., "SVO", "articles", "past_tense"
  modelAudio?: string; // text for TTS
}

// Level 1: Basic SVO Picture → Word Order
const level1Trials: SentenceTrial[] = [
  {
    id: "svo_1",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The dog chases the cat",
    scrambledWords: ["cat", "the", "chases", "dog", "the"],
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
    scrambledWords: ["ball", "boy", "the", "kicks", "the"],
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
    scrambledWords: ["book", "a", "girl", "reads", "the"],
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
    scrambledWords: ["car", "drives", "man", "a", "the"],
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
    scrambledWords: ["milk", "drinks", "baby", "the"],
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
    scrambledWords: ["high", "flies", "bird", "the"],
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
    scrambledWords: ["food", "cooks", "woman", "the"],
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
    scrambledWords: ["fast", "swims", "fish", "the"],
    options: ["fast", "swims", "fish", "the"],
    correctAnswer: ["The", "fish", "swims", "fast"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The fish swims fast"
  }
];

// Level 2: Fill in Function Words
const level2Trials: SentenceTrial[] = [
  {
    id: "func_1",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "The apple is red",
    sentenceTemplate: "___ apple is red",
    options: ["The", "A", "She", "He"],
    correctAnswer: "The",
    distractors: ["A", "She", "He"],
    grammarFocus: "articles",
    modelAudio: "The apple is red"
  },
  {
    id: "func_2",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "She goes to the store",
    sentenceTemplate: "___ goes to the store",
    options: ["She", "He", "They", "The"],
    correctAnswer: "She",
    distractors: ["He", "They", "The"],
    grammarFocus: "pronouns",
    modelAudio: "She goes to the store"
  },
  {
    id: "func_3",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "I am going home",
    sentenceTemplate: "I ___ going home",
    options: ["am", "is", "are", "be"],
    correctAnswer: "am",
    distractors: ["is", "are", "be"],
    grammarFocus: "copula",
    modelAudio: "I am going home"
  },
  {
    id: "func_4",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "The cat is on the table",
    sentenceTemplate: "The cat is ___ the table",
    options: ["on", "in", "at", "to"],
    correctAnswer: "on",
    distractors: ["in", "at", "to"],
    grammarFocus: "prepositions",
    modelAudio: "The cat is on the table"
  },
  {
    id: "func_5",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "We live in a house",
    sentenceTemplate: "We live ___ a house",
    options: ["in", "on", "at", "to"],
    correctAnswer: "in",
    distractors: ["on", "at", "to"],
    grammarFocus: "prepositions",
    modelAudio: "We live in a house"
  },
  {
    id: "func_6",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "The dog barks loud",
    sentenceTemplate: "___ dog barks loud",
    options: ["The", "A", "An", "He"],
    correctAnswer: "The",
    distractors: ["A", "An", "He"],
    grammarFocus: "articles",
    modelAudio: "The dog barks loud"
  },
  {
    id: "func_7",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "He sits on the chair",
    sentenceTemplate: "He sits ___ the chair",
    options: ["on", "in", "at", "to"],
    correctAnswer: "on",
    distractors: ["in", "at", "to"],
    grammarFocus: "prepositions",
    modelAudio: "He sits on the chair"
  },
  {
    id: "func_8",
    taskType: "fill_function",
    difficulty: 2,
    targetSentence: "I have an apple",
    sentenceTemplate: "I have ___ apple",
    options: ["an", "a", "the", "one"],
    correctAnswer: "an",
    distractors: ["a", "the", "one"],
    grammarFocus: "articles",
    modelAudio: "I have an apple"
  }
];

// Level 3: Verb Agreement Fix
const level3Trials: SentenceTrial[] = [
  {
    id: "verb_1",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "He eats dinner",
    sentenceTemplate: "He ___ dinner",
    options: ["eats", "eat", "eating", "ate"],
    correctAnswer: "eats",
    distractors: ["eat", "eating", "ate"],
    grammarFocus: "subject_verb_agreement",
    modelAudio: "He eats dinner"
  },
  {
    id: "verb_2",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "They are running fast",
    sentenceTemplate: "They ___ running fast",
    options: ["are", "is", "am", "be"],
    correctAnswer: "are",
    distractors: ["is", "am", "be"],
    grammarFocus: "plural_agreement",
    modelAudio: "They are running fast"
  },
  {
    id: "verb_3",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "She walks to school",
    sentenceTemplate: "She ___ to school",
    options: ["walks", "walk", "walking", "walked"],
    correctAnswer: "walks",
    distractors: ["walk", "walking", "walked"],
    grammarFocus: "third_person_singular",
    modelAudio: "She walks to school"
  },
  {
    id: "verb_4",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "I was playing outside",
    sentenceTemplate: "I ___ playing outside",
    options: ["was", "were", "is", "am"],
    correctAnswer: "was",
    distractors: ["were", "is", "am"],
    grammarFocus: "past_progressive",
    modelAudio: "I was playing outside"
  },
  {
    id: "verb_5",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "The baby cries loudly",
    sentenceTemplate: "The baby ___ loudly",
    options: ["cries", "cry", "crying", "cried"],
    correctAnswer: "cries",
    distractors: ["cry", "crying", "cried"],
    grammarFocus: "third_person_singular",
    modelAudio: "The baby cries loudly"
  },
  {
    id: "verb_6",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "The birds fly south",
    sentenceTemplate: "The birds ___ south",
    options: ["fly", "flies", "flying", "flew"],
    correctAnswer: "fly",
    distractors: ["flies", "flying", "flew"],
    grammarFocus: "plural_agreement",
    modelAudio: "The birds fly south"
  },
  {
    id: "verb_7",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "He goes to work",
    sentenceTemplate: "He ___ to work",
    options: ["goes", "go", "going", "went"],
    correctAnswer: "goes",
    distractors: ["go", "going", "went"],
    grammarFocus: "third_person_singular",
    modelAudio: "He goes to work"
  },
  {
    id: "verb_8",
    taskType: "verb_agreement",
    difficulty: 3,
    targetSentence: "We eat dinner together",
    sentenceTemplate: "We ___ dinner together",
    options: ["eat", "eats", "eating", "ate"],
    correctAnswer: "eat",
    distractors: ["eats", "eating", "ate"],
    grammarFocus: "plural_agreement",
    modelAudio: "We eat dinner together"
  }
];

// Level 4: Sentence Reordering
const level4Trials: SentenceTrial[] = [
  {
    id: "reorder_1",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "I went to the store",
    scrambledWords: ["went", "store", "to", "I", "the"],
    options: ["went", "store", "to", "I", "the"],
    correctAnswer: ["I", "went", "to", "the", "store"],
    distractors: [],
    grammarFocus: "word_order_complex",
    modelAudio: "I went to the store"
  },
  {
    id: "reorder_2",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "She gave me the book",
    scrambledWords: ["gave", "book", "me", "She", "the"],
    options: ["gave", "book", "me", "She", "the"],
    correctAnswer: ["She", "gave", "me", "the", "book"],
    distractors: [],
    grammarFocus: "ditransitive",
    modelAudio: "She gave me the book"
  },
  {
    id: "reorder_3",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "The dog is sleeping under the bed",
    scrambledWords: ["dog", "is", "sleeping", "the", "under", "bed", "the"],
    options: ["dog", "is", "sleeping", "the", "under", "bed", "the"],
    correctAnswer: ["The", "dog", "is", "sleeping", "under", "the", "bed"],
    distractors: [],
    grammarFocus: "prepositional_phrase",
    modelAudio: "The dog is sleeping under the bed"
  },
  {
    id: "reorder_4",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "My mother bakes cookies",
    scrambledWords: ["cookies", "bakes", "mother", "my"],
    options: ["cookies", "bakes", "mother", "my"],
    correctAnswer: ["My", "mother", "bakes", "cookies"],
    distractors: [],
    grammarFocus: "word_order_complex",
    modelAudio: "My mother bakes cookies"
  },
  {
    id: "reorder_5",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "The baby sleeps in the crib",
    scrambledWords: ["crib", "the", "sleeps", "baby", "in", "the"],
    options: ["crib", "the", "sleeps", "baby", "in", "the"],
    correctAnswer: ["The", "baby", "sleeps", "in", "the", "crib"],
    distractors: [],
    grammarFocus: "prepositional_phrase",
    modelAudio: "The baby sleeps in the crib"
  },
  {
    id: "reorder_6",
    taskType: "sentence_reorder",
    difficulty: 4,
    targetSentence: "We eat breakfast every morning",
    scrambledWords: ["morning", "breakfast", "eat", "every", "we"],
    options: ["morning", "breakfast", "eat", "every", "we"],
    correctAnswer: ["We", "eat", "breakfast", "every", "morning"],
    distractors: [],
    grammarFocus: "word_order_complex",
    modelAudio: "We eat breakfast every morning"
  }
];

// Level 5: Cloze from Picture
const level5Trials: SentenceTrial[] = [
  {
    id: "cloze_1",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "She kicked the ball",
    sentenceTemplate: "She ___ the ball",
    options: ["kicked", "kicks", "kick", "kicking"],
    correctAnswer: "kicked",
    distractors: ["kicks", "kick", "kicking"],
    grammarFocus: "past_tense",
    modelAudio: "She kicked the ball"
  },
  {
    id: "cloze_2",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "They were eating lunch",
    sentenceTemplate: "They ___ eating lunch",
    options: ["were", "was", "are", "is"],
    correctAnswer: "were",
    distractors: ["was", "are", "is"],
    grammarFocus: "past_progressive_plural",
    modelAudio: "They were eating lunch"
  },
  {
    id: "cloze_3",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "He has finished his homework",
    sentenceTemplate: "He ___ finished his homework",
    options: ["has", "have", "had", "is"],
    correctAnswer: "has",
    distractors: ["have", "had", "is"],
    grammarFocus: "present_perfect",
    modelAudio: "He has finished his homework"
  },
  {
    id: "cloze_4",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "The children are playing together",
    sentenceTemplate: "The children ___ playing together",
    options: ["are", "is", "was", "were"],
    correctAnswer: "are",
    distractors: ["is", "was", "were"],
    grammarFocus: "plural_present_progressive",
    modelAudio: "The children are playing together"
  },
  {
    id: "cloze_5",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "I read the book yesterday",
    sentenceTemplate: "I ___ the book yesterday",
    options: ["read", "reads", "reading", "readed"],
    correctAnswer: "read",
    distractors: ["reads", "reading", "readed"],
    grammarFocus: "past_tense",
    modelAudio: "I read the book yesterday"
  },
  {
    id: "cloze_6",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "She was crying when I arrived",
    sentenceTemplate: "She ___ crying when I arrived",
    options: ["was", "were", "is", "are"],
    correctAnswer: "was",
    distractors: ["were", "is", "are"],
    grammarFocus: "past_progressive",
    modelAudio: "She was crying when I arrived"
  },
  {
    id: "cloze_7",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "They have already left",
    sentenceTemplate: "They ___ already left",
    options: ["have", "has", "had", "are"],
    correctAnswer: "have",
    distractors: ["has", "had", "are"],
    grammarFocus: "present_perfect",
    modelAudio: "They have already left"
  },
  {
    id: "cloze_8",
    taskType: "cloze_picture",
    difficulty: 5,
    targetSentence: "We went to the park last week",
    sentenceTemplate: "We ___ to the park last week",
    options: ["went", "go", "goes", "going"],
    correctAnswer: "went",
    distractors: ["go", "goes", "going"],
    grammarFocus: "past_tense",
    modelAudio: "We went to the park last week"
  }
];

// Level 6: Compound Sentences (Coordinating Conjunctions)
const level6Trials: SentenceTrial[] = [
  {
    id: "compound_1",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "I went to the store and bought some bread",
    options: ["bought", "and", "store", "bread", "went", "I", "some", "to", "the"],
    correctAnswer: ["I", "went", "to", "the", "store", "and", "bought", "some", "bread"],
    distractors: [],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "I went to the store and bought some bread"
  },
  {
    id: "compound_2",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "She was tired but she finished her work",
    options: ["work", "but", "tired", "she", "was", "her", "She", "finished"],
    correctAnswer: ["She", "was", "tired", "but", "she", "finished", "her", "work"],
    distractors: [],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "She was tired but she finished her work"
  },
  {
    id: "compound_3",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "The dog barked and the cat ran away",
    options: ["ran", "barked", "and", "away", "the", "dog", "cat", "The"],
    correctAnswer: ["The", "dog", "barked", "and", "the", "cat", "ran", "away"],
    distractors: [],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "The dog barked and the cat ran away"
  },
  {
    id: "compound_4",
    taskType: "fill_function",
    difficulty: 6,
    targetSentence: "I wanted coffee but the shop was closed",
    sentenceTemplate: "I wanted coffee ___ the shop was closed",
    options: ["but", "and", "or", "so"],
    correctAnswer: "but",
    distractors: ["and", "or", "so"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "I wanted coffee but the shop was closed"
  },
  {
    id: "compound_5",
    taskType: "fill_function",
    difficulty: 6,
    targetSentence: "You can have tea or you can have juice",
    sentenceTemplate: "You can have tea ___ you can have juice",
    options: ["or", "and", "but", "so"],
    correctAnswer: "or",
    distractors: ["and", "but", "so"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "You can have tea or you can have juice"
  },
  {
    id: "compound_6",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "He studied hard so he passed the test",
    options: ["test", "passed", "so", "hard", "studied", "the", "He", "he"],
    correctAnswer: ["He", "studied", "hard", "so", "he", "passed", "the", "test"],
    distractors: [],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "He studied hard so he passed the test"
  },
  {
    id: "compound_7",
    taskType: "fill_function",
    difficulty: 6,
    targetSentence: "The movie was long and it was boring",
    sentenceTemplate: "The movie was long ___ it was boring",
    options: ["and", "but", "or", "so"],
    correctAnswer: "and",
    distractors: ["but", "or", "so"],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "The movie was long and it was boring"
  },
  {
    id: "compound_8",
    taskType: "sentence_reorder",
    difficulty: 6,
    targetSentence: "We can stay home or we can go out",
    options: ["out", "or", "stay", "go", "can", "we", "We", "home"],
    correctAnswer: ["We", "can", "stay", "home", "or", "we", "can", "go", "out"],
    distractors: [],
    grammarFocus: "coordinating_conjunctions",
    modelAudio: "We can stay home or we can go out"
  }
];

// Level 7: Complex Sentences (Subordinating Conjunctions)
const level7Trials: SentenceTrial[] = [
  {
    id: "subordinate_1",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "Because it was raining we stayed inside",
    options: ["inside", "was", "raining", "we", "Because", "it", "stayed"],
    correctAnswer: ["Because", "it", "was", "raining", "we", "stayed", "inside"],
    distractors: [],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "Because it was raining we stayed inside"
  },
  {
    id: "subordinate_2",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "When the phone rang she answered it quickly",
    options: ["quickly", "answered", "rang", "it", "she", "phone", "When", "the"],
    correctAnswer: ["When", "the", "phone", "rang", "she", "answered", "it", "quickly"],
    distractors: [],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "When the phone rang she answered it quickly"
  },
  {
    id: "subordinate_3",
    taskType: "fill_function",
    difficulty: 7,
    targetSentence: "Although he was tired he kept working",
    sentenceTemplate: "___ he was tired he kept working",
    options: ["Although", "Because", "When", "If"],
    correctAnswer: "Although",
    distractors: ["Because", "When", "If"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "Although he was tired he kept working"
  },
  {
    id: "subordinate_4",
    taskType: "fill_function",
    difficulty: 7,
    targetSentence: "If you need help please ask me",
    sentenceTemplate: "___ you need help please ask me",
    options: ["If", "Although", "Because", "While"],
    correctAnswer: "If",
    distractors: ["Although", "Because", "While"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "If you need help please ask me"
  },
  {
    id: "subordinate_5",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "While I was cooking dinner he set the table",
    options: ["table", "set", "cooking", "While", "was", "I", "he", "dinner", "the"],
    correctAnswer: ["While", "I", "was", "cooking", "dinner", "he", "set", "the", "table"],
    distractors: [],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "While I was cooking dinner he set the table"
  },
  {
    id: "subordinate_6",
    taskType: "fill_function",
    difficulty: 7,
    targetSentence: "She left early because she had an appointment",
    sentenceTemplate: "She left early ___ she had an appointment",
    options: ["because", "although", "when", "if"],
    correctAnswer: "because",
    distractors: ["although", "when", "if"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "She left early because she had an appointment"
  },
  {
    id: "subordinate_7",
    taskType: "sentence_reorder",
    difficulty: 7,
    targetSentence: "Before you leave please turn off the lights",
    options: ["lights", "off", "leave", "turn", "Before", "you", "please", "the"],
    correctAnswer: ["Before", "you", "leave", "please", "turn", "off", "the", "lights"],
    distractors: [],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "Before you leave please turn off the lights"
  },
  {
    id: "subordinate_8",
    taskType: "fill_function",
    difficulty: 7,
    targetSentence: "After the movie ended we went for ice cream",
    sentenceTemplate: "___ the movie ended we went for ice cream",
    options: ["After", "Before", "While", "Because"],
    correctAnswer: "After",
    distractors: ["Before", "While", "Because"],
    grammarFocus: "subordinating_conjunctions",
    modelAudio: "After the movie ended we went for ice cream"
  }
];

// Level 8: Relative Clauses
const level8Trials: SentenceTrial[] = [
  {
    id: "relative_1",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The man who lives next door is a doctor",
    options: ["doctor", "is", "who", "door", "next", "lives", "a", "man", "The"],
    correctAnswer: ["The", "man", "who", "lives", "next", "door", "is", "a", "doctor"],
    distractors: [],
    grammarFocus: "relative_clauses",
    modelAudio: "The man who lives next door is a doctor"
  },
  {
    id: "relative_2",
    taskType: "fill_function",
    difficulty: 8,
    targetSentence: "I saw the movie that you recommended",
    sentenceTemplate: "I saw the movie ___ you recommended",
    options: ["that", "who", "where", "when"],
    correctAnswer: "that",
    distractors: ["who", "where", "when"],
    grammarFocus: "relative_clauses",
    modelAudio: "I saw the movie that you recommended"
  },
  {
    id: "relative_3",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The book which I borrowed was very interesting",
    options: ["interesting", "very", "was", "borrowed", "I", "which", "book", "The"],
    correctAnswer: ["The", "book", "which", "I", "borrowed", "was", "very", "interesting"],
    distractors: [],
    grammarFocus: "relative_clauses",
    modelAudio: "The book which I borrowed was very interesting"
  },
  {
    id: "relative_4",
    taskType: "fill_function",
    difficulty: 8,
    targetSentence: "The woman who called you is my sister",
    sentenceTemplate: "The woman ___ called you is my sister",
    options: ["who", "which", "that", "where"],
    correctAnswer: "who",
    distractors: ["which", "that", "where"],
    grammarFocus: "relative_clauses",
    modelAudio: "The woman who called you is my sister"
  },
  {
    id: "relative_5",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The restaurant where we ate was excellent",
    options: ["excellent", "was", "ate", "we", "where", "restaurant", "The"],
    correctAnswer: ["The", "restaurant", "where", "we", "ate", "was", "excellent"],
    distractors: [],
    grammarFocus: "relative_clauses",
    modelAudio: "The restaurant where we ate was excellent"
  },
  {
    id: "relative_6",
    taskType: "fill_function",
    difficulty: 8,
    targetSentence: "The day when we met was sunny",
    sentenceTemplate: "The day ___ we met was sunny",
    options: ["when", "where", "who", "which"],
    correctAnswer: "when",
    distractors: ["where", "who", "which"],
    grammarFocus: "relative_clauses",
    modelAudio: "The day when we met was sunny"
  },
  {
    id: "relative_7",
    taskType: "sentence_reorder",
    difficulty: 8,
    targetSentence: "The car that he bought is very fast",
    options: ["fast", "very", "is", "bought", "he", "that", "car", "The"],
    correctAnswer: ["The", "car", "that", "he", "bought", "is", "very", "fast"],
    distractors: [],
    grammarFocus: "relative_clauses",
    modelAudio: "The car that he bought is very fast"
  },
  {
    id: "relative_8",
    taskType: "fill_function",
    difficulty: 8,
    targetSentence: "The house where I grew up is now a museum",
    sentenceTemplate: "The house ___ I grew up is now a museum",
    options: ["where", "which", "who", "when"],
    correctAnswer: "where",
    distractors: ["which", "who", "when"],
    grammarFocus: "relative_clauses",
    modelAudio: "The house where I grew up is now a museum"
  }
];

// Level 9: Multi-clause Complex Sentences
const level9Trials: SentenceTrial[] = [
  {
    id: "multiclause_1",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "After eating breakfast we walked to the park together",
    options: ["together", "park", "the", "to", "walked", "we", "breakfast", "eating", "After"],
    correctAnswer: ["After", "eating", "breakfast", "we", "walked", "to", "the", "park", "together"],
    distractors: [],
    grammarFocus: "multi_clause_order",
    modelAudio: "After eating breakfast we walked to the park together"
  },
  {
    id: "multiclause_2",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "The children who were playing stopped when it started raining",
    options: ["raining", "started", "it", "when", "stopped", "playing", "were", "who", "children", "The"],
    correctAnswer: ["The", "children", "who", "were", "playing", "stopped", "when", "it", "started", "raining"],
    distractors: [],
    grammarFocus: "multi_clause_order",
    modelAudio: "The children who were playing stopped when it started raining"
  },
  {
    id: "multiclause_3",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "Although the weather was bad we decided to go hiking",
    options: ["hiking", "go", "to", "decided", "we", "bad", "was", "weather", "the", "Although"],
    correctAnswer: ["Although", "the", "weather", "was", "bad", "we", "decided", "to", "go", "hiking"],
    distractors: [],
    grammarFocus: "multi_clause_order",
    modelAudio: "Although the weather was bad we decided to go hiking"
  },
  {
    id: "multiclause_4",
    taskType: "fill_function",
    difficulty: 9,
    targetSentence: "The student who studied hard passed because she prepared well",
    sentenceTemplate: "The student who studied hard passed ___ she prepared well",
    options: ["because", "although", "when", "while"],
    correctAnswer: "because",
    distractors: ["although", "when", "while"],
    grammarFocus: "multi_clause_order",
    modelAudio: "The student who studied hard passed because she prepared well"
  },
  {
    id: "multiclause_5",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "Before the guests arrived she had already cleaned the house",
    options: ["house", "the", "cleaned", "already", "had", "she", "arrived", "guests", "the", "Before"],
    correctAnswer: ["Before", "the", "guests", "arrived", "she", "had", "already", "cleaned", "the", "house"],
    distractors: [],
    grammarFocus: "multi_clause_order",
    modelAudio: "Before the guests arrived she had already cleaned the house"
  },
  {
    id: "multiclause_6",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "When I finish my work I will call you immediately",
    options: ["immediately", "you", "call", "will", "I", "work", "my", "finish", "I", "When"],
    correctAnswer: ["When", "I", "finish", "my", "work", "I", "will", "call", "you", "immediately"],
    distractors: [],
    grammarFocus: "multi_clause_order",
    modelAudio: "When I finish my work I will call you immediately"
  },
  {
    id: "multiclause_7",
    taskType: "fill_function",
    difficulty: 9,
    targetSentence: "He left the party early although everyone wanted him to stay",
    sentenceTemplate: "He left the party early ___ everyone wanted him to stay",
    options: ["although", "because", "when", "before"],
    correctAnswer: "although",
    distractors: ["because", "when", "before"],
    grammarFocus: "multi_clause_order",
    modelAudio: "He left the party early although everyone wanted him to stay"
  },
  {
    id: "multiclause_8",
    taskType: "sentence_reorder",
    difficulty: 9,
    targetSentence: "Since you helped me yesterday I will help you today",
    options: ["today", "you", "help", "will", "I", "yesterday", "me", "helped", "you", "Since"],
    correctAnswer: ["Since", "you", "helped", "me", "yesterday", "I", "will", "help", "you", "today"],
    distractors: [],
    grammarFocus: "multi_clause_order",
    modelAudio: "Since you helped me yesterday I will help you today"
  }
];

// Level 10: Advanced Grammar (Passive Voice, Conditionals, Perfect Progressive)
const level10Trials: SentenceTrial[] = [
  {
    id: "advanced_1",
    taskType: "verb_agreement",
    difficulty: 10,
    targetSentence: "The cake was baked by my grandmother",
    sentenceTemplate: "The cake was ___ by my grandmother",
    options: ["baked", "baking", "bake", "bakes"],
    correctAnswer: "baked",
    distractors: ["baking", "bake", "bakes"],
    grammarFocus: "passive_voice",
    modelAudio: "The cake was baked by my grandmother"
  },
  {
    id: "advanced_2",
    taskType: "verb_agreement",
    difficulty: 10,
    targetSentence: "The letter was written by the manager",
    sentenceTemplate: "The letter was ___ by the manager",
    options: ["written", "writing", "wrote", "write"],
    correctAnswer: "written",
    distractors: ["writing", "wrote", "write"],
    grammarFocus: "passive_voice",
    modelAudio: "The letter was written by the manager"
  },
  {
    id: "advanced_3",
    taskType: "fill_function",
    difficulty: 10,
    targetSentence: "If it rains tomorrow we will stay inside",
    sentenceTemplate: "___ it rains tomorrow we will stay inside",
    options: ["If", "When", "Because", "Although"],
    correctAnswer: "If",
    distractors: ["When", "Because", "Although"],
    grammarFocus: "conditionals",
    modelAudio: "If it rains tomorrow we will stay inside"
  },
  {
    id: "advanced_4",
    taskType: "verb_agreement",
    difficulty: 10,
    targetSentence: "She has been waiting for three hours",
    sentenceTemplate: "She has been ___ for three hours",
    options: ["waiting", "waited", "wait", "waits"],
    correctAnswer: "waiting",
    distractors: ["waited", "wait", "waits"],
    grammarFocus: "perfect_progressive",
    modelAudio: "She has been waiting for three hours"
  },
  {
    id: "advanced_5",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "The window was broken by the children playing ball",
    options: ["ball", "playing", "children", "the", "by", "broken", "was", "window", "The"],
    correctAnswer: ["The", "window", "was", "broken", "by", "the", "children", "playing", "ball"],
    distractors: [],
    grammarFocus: "passive_voice",
    modelAudio: "The window was broken by the children playing ball"
  },
  {
    id: "advanced_6",
    taskType: "verb_agreement",
    difficulty: 10,
    targetSentence: "They have been studying English for five years",
    sentenceTemplate: "They have been ___ English for five years",
    options: ["studying", "studied", "study", "studies"],
    correctAnswer: "studying",
    distractors: ["studied", "study", "studies"],
    grammarFocus: "perfect_progressive",
    modelAudio: "They have been studying English for five years"
  },
  {
    id: "advanced_7",
    taskType: "fill_function",
    difficulty: 10,
    targetSentence: "If I had known I would have helped you",
    sentenceTemplate: "___ I had known I would have helped you",
    options: ["If", "When", "Because", "Although"],
    correctAnswer: "If",
    distractors: ["When", "Because", "Although"],
    grammarFocus: "conditionals",
    modelAudio: "If I had known I would have helped you"
  },
  {
    id: "advanced_8",
    taskType: "sentence_reorder",
    difficulty: 10,
    targetSentence: "The report will be finished by the end of the week",
    options: ["week", "the", "of", "end", "the", "by", "finished", "be", "will", "report", "The"],
    correctAnswer: ["The", "report", "will", "be", "finished", "by", "the", "end", "of", "the", "week"],
    distractors: [],
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
  userAnswer: string | string[]
): {
  errorType: GrammarErrorType | null;
  incorrectPosition?: number;
  explanation: string;
} => {
  const correct = trial.correctAnswer;
  
  // For array answers (word order tasks)
  if (Array.isArray(correct) && Array.isArray(userAnswer)) {
    for (let i = 0; i < correct.length; i++) {
      if (correct[i].toLowerCase() !== userAnswer[i]?.toLowerCase()) {
        return {
          errorType: "word_order",
          incorrectPosition: i,
          explanation: `Word order error at position ${i + 1}`
        };
      }
    }
  }
  
  // For single word answers
  if (typeof correct === "string" && typeof userAnswer === "string") {
    if (correct.toLowerCase() !== userAnswer.toLowerCase()) {
      // Determine error type based on grammar focus
      if (trial.grammarFocus.includes("agreement")) {
        return {
          errorType: "agreement_error",
          explanation: "Subject-verb agreement error"
        };
      } else if (trial.grammarFocus.includes("tense") || trial.grammarFocus.includes("progressive")) {
        return {
          errorType: "tense_error",
          explanation: "Verb tense error"
        };
      } else if (trial.grammarFocus.includes("article") || trial.grammarFocus.includes("pronoun")) {
        return {
          errorType: "function_word_omission",
          explanation: "Function word error"
        };
      } else if (trial.grammarFocus.includes("verb") || trial.grammarFocus.includes("passive")) {
        return {
          errorType: "verb_inflection",
          explanation: "Verb form error"
        };
      } else if (trial.grammarFocus.includes("conjunction")) {
        return {
          errorType: "conjunction_error",
          explanation: "Conjunction error"
        };
      } else if (trial.grammarFocus.includes("relative")) {
        return {
          errorType: "relative_clause_error",
          explanation: "Relative pronoun error"
        };
      } else if (trial.grammarFocus.includes("conditional")) {
        return {
          errorType: "conjunction_error",
          explanation: "Conditional structure error"
        };
      }
    }
  }
  
  return {
    errorType: null,
    explanation: "Correct"
  };
};
