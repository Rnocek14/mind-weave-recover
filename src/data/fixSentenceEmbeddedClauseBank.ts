/**
 * Fix the Sentence — L7 embedded-clause repair stimuli.
 *
 * Adult functional relative/complement clauses with ONE intentionally wrong
 * connector. Patients replace that word, keeping the larger sentence intact.
 * These are provisional practice stimuli awaiting SLP review; their presence
 * does not establish clinical efficacy or spontaneous syntax production.
 *
 * Existing errorType='function_error' is retained for compatibility with
 * legacy consumers; the explicit embeddedClause tag identifies the grammar.
 */
import type { FixSentenceTrial } from './fixSentenceBank';

interface EmbeddedClauseSeed {
  id: string;
  sentence: string;
  wrongWord: string;
  acceptedFixes: [string, ...string[]];
  correctedSentence: string;
  construction: 'relative_subject' | 'relative_object' | 'complement_clause';
  category: string;
}

const SEEDS: readonly EmbeddedClauseSeed[] = [
  {
    id: 'fse_1', sentence: 'The nurse which called me this morning was helpful.',
    wrongWord: 'which', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The nurse who called me this morning was helpful.',
    construction: 'relative_subject', category: 'healthcare',
  },
  {
    id: 'fse_2', sentence: 'The electrician where repaired the lights finished early.',
    wrongWord: 'where', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The electrician who repaired the lights finished early.',
    construction: 'relative_subject', category: 'home',
  },
  {
    id: 'fse_3', sentence: 'The neighbor when brought our mail was friendly.',
    wrongWord: 'when', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The neighbor who brought our mail was friendly.',
    construction: 'relative_subject', category: 'community',
  },
  {
    id: 'fse_4', sentence: 'The driver why waited for us was patient.',
    wrongWord: 'why', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The driver who waited for us was patient.',
    construction: 'relative_subject', category: 'transportation',
  },
  {
    id: 'fse_5', sentence: 'The teacher which helped my daughter called yesterday.',
    wrongWord: 'which', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The teacher who helped my daughter called yesterday.',
    construction: 'relative_subject', category: 'family',
  },
  {
    id: 'fse_6', sentence: 'The technician where fixed our computer works nearby.',
    wrongWord: 'where', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The technician who fixed our computer works nearby.',
    construction: 'relative_subject', category: 'technology',
  },
  {
    id: 'fse_7', sentence: 'The caregiver which checked the schedule arrived early.',
    wrongWord: 'which', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The caregiver who checked the schedule arrived early.',
    construction: 'relative_subject', category: 'healthcare',
  },
  {
    id: 'fse_8', sentence: 'The gardener when watered the flowers left a note.',
    wrongWord: 'when', acceptedFixes: ['who', 'that'],
    correctedSentence: 'The gardener who watered the flowers left a note.',
    construction: 'relative_subject', category: 'home',
  },
  {
    id: 'fse_9', sentence: 'The book who you recommended is on the table.',
    wrongWord: 'who', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The book that you recommended is on the table.',
    construction: 'relative_object', category: 'leisure',
  },
  {
    id: 'fse_10', sentence: 'The package who arrived today is on the porch.',
    wrongWord: 'who', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The package that arrived today is on the porch.',
    construction: 'relative_subject', category: 'home',
  },
  {
    id: 'fse_11', sentence: 'The chair whose I bought last week fits well.',
    wrongWord: 'whose', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The chair that I bought last week fits well.',
    construction: 'relative_object', category: 'home',
  },
  {
    id: 'fse_12', sentence: 'The movie whom we watched together was funny.',
    wrongWord: 'whom', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The movie that we watched together was funny.',
    construction: 'relative_object', category: 'leisure',
  },
  {
    id: 'fse_13', sentence: 'The report whom I printed yesterday is ready.',
    wrongWord: 'whom', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The report that I printed yesterday is ready.',
    construction: 'relative_object', category: 'office',
  },
  {
    id: 'fse_14', sentence: 'The jacket who she ordered arrived this morning.',
    wrongWord: 'who', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The jacket that she ordered arrived this morning.',
    construction: 'relative_object', category: 'shopping',
  },
  {
    id: 'fse_15', sentence: 'The letter why I mailed last week arrived today.',
    wrongWord: 'why', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The letter that I mailed last week arrived today.',
    construction: 'relative_object', category: 'communication',
  },
  {
    id: 'fse_16', sentence: 'The machine whose we purchased is working well.',
    wrongWord: 'whose', acceptedFixes: ['that', 'which'],
    correctedSentence: 'The machine that we purchased is working well.',
    construction: 'relative_object', category: 'home',
  },
  {
    id: 'fse_17', sentence: 'I hope which the appointment starts on time.',
    wrongWord: 'which', acceptedFixes: ['that'],
    correctedSentence: 'I hope that the appointment starts on time.',
    construction: 'complement_clause', category: 'healthcare',
  },
  {
    id: 'fse_18', sentence: 'She said whose the clinic would call tomorrow.',
    wrongWord: 'whose', acceptedFixes: ['that'],
    correctedSentence: 'She said that the clinic would call tomorrow.',
    construction: 'complement_clause', category: 'healthcare',
  },
  {
    id: 'fse_19', sentence: 'We believe who the road will be clear by noon.',
    wrongWord: 'who', acceptedFixes: ['that'],
    correctedSentence: 'We believe that the road will be clear by noon.',
    construction: 'complement_clause', category: 'transportation',
  },
  {
    id: 'fse_20', sentence: 'He thinks where his ride will arrive soon.',
    wrongWord: 'where', acceptedFixes: ['that'],
    correctedSentence: 'He thinks that his ride will arrive soon.',
    construction: 'complement_clause', category: 'transportation',
  },
  {
    id: 'fse_21', sentence: 'The doctor confirmed which the test was finished.',
    wrongWord: 'which', acceptedFixes: ['that'],
    correctedSentence: 'The doctor confirmed that the test was finished.',
    construction: 'complement_clause', category: 'healthcare',
  },
  {
    id: 'fse_22', sentence: 'I heard whose the package was delivered yesterday.',
    wrongWord: 'whose', acceptedFixes: ['that'],
    correctedSentence: 'I heard that the package was delivered yesterday.',
    construction: 'complement_clause', category: 'home',
  },
  {
    id: 'fse_23', sentence: 'They expect whom the weather will improve this afternoon.',
    wrongWord: 'whom', acceptedFixes: ['that'],
    correctedSentence: 'They expect that the weather will improve this afternoon.',
    construction: 'complement_clause', category: 'daily_routine',
  },
  {
    id: 'fse_24', sentence: 'She believes who her brother will return today.',
    wrongWord: 'who', acceptedFixes: ['that'],
    correctedSentence: 'She believes that her brother will return today.',
    construction: 'complement_clause', category: 'family',
  },
];

function buildTrial(seed: EmbeddedClauseSeed): FixSentenceTrial {
  const words = seed.sentence.split(/\s+/);
  const indices = words.flatMap((token, i) =>
    token.toLowerCase().replace(/[^a-z]/g, '') === seed.wrongWord ? [i] : [],
  );
  // Fail loudly in development/CI if a cue points to the wrong token;
  // corrupt training stimuli must not be silently served to patients.
  if (indices.length !== 1) {
    throw new Error(`L7 embedded clause ${seed.id}: expected one wrong-word occurrence, found ${indices.length}`);
  }
  return {
    id: seed.id,
    sentence: seed.sentence,
    wrongWord: seed.wrongWord,
    wrongWordIndex: indices[0] + 1,
    acceptedFixes: [...seed.acceptedFixes],
    fixAliases: {},
    category: seed.category,
    difficulty: 3,
    errorType: 'function_error',
    phonemeTargets: [],
    embeddedClause: {
      construction: seed.construction,
      correctedSentence: seed.correctedSentence,
    },
  };
}

export const FIX_SENTENCE_EMBEDDED_CLAUSE_BANK: FixSentenceTrial[] = SEEDS.map(buildTrial);
