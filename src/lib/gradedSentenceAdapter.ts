/**
 * Graded Sentence Adapter
 * 
 * Converts GradedSentence entries into SentenceTrial format
 * so the Sentence Construction exercise can use phoneme-targeted,
 * difficulty-adaptive sentences from the graded sentence bank.
 * 
 * L1 (single word) entries are excluded — sentence construction
 * requires at least 2 words. Mapping:
 *   L2 (simple) → difficulty 1-4  
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

/** Map SentenceTrial difficulty (1-10) to graded sentence level.
 *  L1 (single word) is excluded — minimum is L2. */
export function difficultyToGradedLevel(difficulty: number): 2 | 3 | 4 {
  if (difficulty <= 4) return 2;
  if (difficulty <= 7) return 3;
  return 4;
}

/** Map graded level back to approximate SentenceTrial difficulty */
function gradedLevelToDifficulty(level: 2 | 3 | 4): number {
  const map: Record<number, number> = { 2: 3, 3: 5, 4: 8 };
  return map[level];
}

/** Convert a GradedSentence into a SentenceTrial (word-ordering format).
 *  Returns null for single-word entries. */
export function gradedSentenceToTrial(gs: GradedSentence): SentenceTrial | null {
  const words = gs.sentence.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
  
  // Reject single-word entries — not useful for sentence construction
  if (words.length < 2) return null;
  
  const correctAnswer = [...words];
  const options = [...words].sort(() => Math.random() - 0.5);
  
  return {
    id: `graded-${gs.id}`,
    taskType: 'word_order',
    difficulty: gradedLevelToDifficulty(gs.level as 2 | 3 | 4),
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
 * Only returns L2+ (multi-word) sentences.
 */
export function getAdaptiveGradedTrials(
  difficulty: number,
  focusPhonemes: string[] = [],
  count: number = 5
): SentenceTrial[] {
  const targetLevel = difficultyToGradedLevel(difficulty);
  
  let candidates: GradedSentence[];
  
  if (focusPhonemes.length > 0) {
    const phonemeMatches = new Set<string>();
    const matched: GradedSentence[] = [];
    
    for (const phoneme of focusPhonemes) {
      const sentences = getGradedSentencesByPhoneme(phoneme)
        .filter(s => s.level >= 2 && s.level === targetLevel);
      for (const s of sentences) {
        if (!phonemeMatches.has(s.id)) {
          phonemeMatches.add(s.id);
          matched.push(s);
        }
      }
    }
    
    // Widen to adjacent levels (but never L1)
    if (matched.length < count) {
      const adjacent = [targetLevel - 1, targetLevel + 1].filter(
        l => l >= 2 && l <= 4
      ) as (2 | 3 | 4)[];
      
      for (const adjLevel of adjacent) {
        for (const phoneme of focusPhonemes) {
          const sentences = getGradedSentencesByPhoneme(phoneme)
            .filter(s => s.level >= 2 && s.level === adjLevel);
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
    candidates = getGradedSentencesByLevel(targetLevel).filter(s => s.level >= 2);
  }
  
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const trials = shuffled.map(gradedSentenceToTrial).filter((t): t is SentenceTrial => t !== null);
  return trials.slice(0, count);
}
