/**
 * Phrase Practice: three executable SCRIPT PRACTICE modes with existing bank.
 * These are training tasks, not verified clinical recovery/milestones. L4–L8
 * remain aspirational until situational prompts, variations and SLP approval.
 */
import { getTrialsForLevel, type PhraseTrial } from '@/data/phraseBank';

export interface PhraseTrainingStage {
  level: 1 | 2 | 3;
  label: string;
  engineLevel: 1 | 3;
  mode: 'modeled' | 'completion' | 'key_words';
  autoModel: boolean;
}

const MODES: Readonly<Record<1 | 2 | 3, PhraseTrainingStage>> = {
  1: {
    level: 1,
    label: 'Repeat a short familiar phrase',
    engineLevel: 1,
    mode: 'modeled',
    autoModel: true,
  },
  2: {
    level: 2,
    label: 'Complete a short familiar phrase',
    engineLevel: 1,
    mode: 'completion',
    autoModel: false,
  },
  3: {
    level: 3,
    label: 'Recall a functional phrase from key words',
    engineLevel: 3,
    mode: 'key_words',
    autoModel: false,
  },
};

/** Higher persisted levels are NEVER disguised as a supported script mode. */
export function getPhraseTrainingStage(level: number | null | undefined): PhraseTrainingStage | null {
  if (level == null || !Number.isInteger(level) || level < 1 || level > 3) return null;
  return MODES[level as 1 | 2 | 3];
}

export interface PhraseTrainingPrompt {
  title: string;
  text: string;
  fullPhraseRevealed: boolean;
  /** Every mode has lexical and/or model support; never independent mastery. */
  evidenceSupport: 'visible_script' | 'partial_script' | 'word_clues';
}

export function getPhraseTrainingPrompt(
  trial: Pick<PhraseTrial, 'phrase' | 'cueWords' | 'category'>,
  stage: PhraseTrainingStage | null | undefined,
  reveal = false,
): PhraseTrainingPrompt {
  if (!stage || stage.mode === 'modeled' || reveal) {
    return {
      title: reveal && stage?.mode !== 'modeled' ? 'Whole phrase shown (extra help)' : 'Practice this phrase',
      text: trial.phrase,
      fullPhraseRevealed: true,
      evidenceSupport: 'visible_script',
    };
  }
  if (stage.mode === 'completion') {
    const words = trial.phrase.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return {
      title: 'Practice this phrase',
      text: trial.phrase,
      fullPhraseRevealed: true,
      evidenceSupport: 'visible_script',
    };
    return {
      title: 'Finish the phrase',
      // Show the first word only: every hidden word stays hidden in the DOM
      // until the patient chooses to reveal the full practiced target.
      text: words[0] + ' ' + words.slice(1).map(() => '_____').join(' '),
      fullPhraseRevealed: false,
      evidenceSupport: 'partial_script',
    };
  }
  const cues = (trial.cueWords ?? []).filter(Boolean);
  if (cues.length === 0) {
    // Never present a guess-the-invisible-target task without clues.
    return {
      title: 'Practice this phrase',
      text: trial.phrase,
      fullPhraseRevealed: true,
      evidenceSupport: 'visible_script',
    };
  }
  return {
    title: 'Recall your phrase using these key words',
    text: cues.join(' • '),
    fullPhraseRevealed: false,
    evidenceSupport: 'word_clues',
  };
}

/**
 * Select actual playable stage content, not generic bank items carrying an
 * aspirational label. A single word like "Yes" cannot be a missing-word
 * PHRASE completion task. Preserve those items at Stage 1 repetition.
 */
export function getPhraseTrialsForTraining(
  stage: PhraseTrainingStage,
  requested: number,
): PhraseTrial[] {
  if (!Number.isFinite(requested) || requested <= 0) return [];
  const count = Math.max(0, Math.floor(requested));
  const pool = getTrialsForLevel(stage.engineLevel, stage.mode === 'completion'
    ? Math.max(count * 2, count + 10)
    : count);
  const playable = stage.mode === 'completion'
    ? pool.filter(trial => trial.phrase.trim().split(/\s+/).filter(Boolean).length >= 2)
    : stage.mode === 'key_words'
      ? pool.filter(trial => (trial.cueWords ?? []).some(cue => !!cue.trim()))
      : pool;
  // Do not fall back silently to the wrong task or invent a target.
  return playable.slice(0, count);
}
