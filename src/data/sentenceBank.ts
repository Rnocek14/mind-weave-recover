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
  | "agreement_error";

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

export const SENTENCE_TRIALS = [
  ...level1Trials,
  ...level2Trials,
  ...level3Trials,
  ...level4Trials,
  ...level5Trials
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
      } else if (trial.grammarFocus.includes("tense")) {
        return {
          errorType: "tense_error",
          explanation: "Verb tense error"
        };
      } else if (trial.grammarFocus.includes("article") || trial.grammarFocus.includes("pronoun")) {
        return {
          errorType: "function_word_omission",
          explanation: "Function word error"
        };
      } else if (trial.grammarFocus.includes("verb")) {
        return {
          errorType: "verb_inflection",
          explanation: "Verb form error"
        };
      }
    }
  }
  
  return {
    errorType: null,
    explanation: "Correct"
  };
};
