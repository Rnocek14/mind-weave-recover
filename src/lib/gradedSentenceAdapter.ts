/**
 * Graded Sentence Adapter
 * 
 * Converts GradedSentence entries into SentenceTrial format
 * so the Sentence Construction exercise can use phoneme-targeted,
 * difficulty-adaptive sentences from the graded sentence bank.
 * 
 * Graded levels map to SentenceTrial difficulty:
 *   L1 (word) → difficulty 1-2
 *   L2 (simple) → difficulty 3-4  
 *   L3 (expanded) → difficulty 5-7
 *   L4 (complex) → difficulty 8-10
 */

import type { SentenceTrial } from '@/data/sentenceBank';
import {
  GRADED_SENTENCE_BANK,
  type GradedSentence,
  getGradedSentencesByPhoneme,
  getGradedSentencesByLevel,
} from '@/data/gradedSentenceBank';

/** Map SentenceTrial difficulty (1-10) to graded sentence level (1-4) */
export function difficultyToGradedLevel(difficulty: number): 1 | 2 | 3 | 4 {
  if (difficulty <= 2) return 1;
  if (difficulty <= 4) return 2;
  if (difficulty <= 7) return 3;
  return 4;
}

/** Map graded level back to approximate SentenceTrial difficulty */
function gradedLevelToDifficulty(level: 1 | 2 | 3 | 4): number {
  const map: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 8 };
  return map[level];
}

/** Convert a GradedSentence into a SentenceTrial (word-ordering format) */
export function gradedSentenceToTrial(gs: GradedSentence): SentenceTrial {
  const words = gs.sentence.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
  const correctAnswer = [...words];
  
  // Shuffle options for the word-ordering task
  const options = [...words].sort(() => Math.random() - 0.5);
  
  return {
    id: `graded-${gs.id}`,
    taskType: 'word_order',
    difficulty: gradedLevelToDifficulty(gs.level),
    targetSentence: gs.sentence.replace(/\.$/, ''),
    options,
    correctAnswer,
    distractors: [],
    grammarFocus: `phoneme_${gs.targetWord}`,
    modelAudio: gs.sentence.replace(/\.$/, ''),
  };
}

/**
 * Get phoneme-targeted graded trials for the Sentence Construction exercise.
 * 
 * @param difficulty - Current exercise difficulty level (1-10)
 * @param focusPhonemes - Phonemes to target (from adaptation contract)
 * @param count - Number of trials to return
 */
export function getAdaptiveGradedTrials(
  difficulty: number,
  focusPhonemes: string[] = [],
  count: number = 5
): SentenceTrial[] {
  const targetLevel = difficultyToGradedLevel(difficulty);
  
  let candidates: GradedSentence[];
  
  if (focusPhonemes.length > 0) {
    // Prioritize sentences targeting the focus phonemes
    const phonemeMatches = new Set<string>();
    const matched: GradedSentence[] = [];
    
    for (const phoneme of focusPhonemes) {
      const sentences = getGradedSentencesByPhoneme(phoneme)
        .filter(s => s.level === targetLevel);
      for (const s of sentences) {
        if (!phonemeMatches.has(s.id)) {
          phonemeMatches.add(s.id);
          matched.push(s);
        }
      }
    }
    
    // If not enough phoneme matches at exact level, widen to adjacent levels
    if (matched.length < count) {
      const adjacent = [targetLevel - 1, targetLevel + 1].filter(
        l => l >= 1 && l <= 4
      ) as (1 | 2 | 3 | 4)[];
      
      for (const adjLevel of adjacent) {
        for (const phoneme of focusPhonemes) {
          const sentences = getGradedSentencesByPhoneme(phoneme)
            .filter(s => s.level === adjLevel);
          for (const s of sentences) {
            if (!phonemeMatches.has(s.id)) {
              phonemeMatches.add(s.id);
              matched.push(s);
            }
          }
        }
      }
    }
    
    candidates = matched;
  } else {
    // No phoneme targeting: use level-appropriate sentences
    candidates = getGradedSentencesByLevel(targetLevel);
  }
  
  // Shuffle and take requested count
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(gradedSentenceToTrial);
}
