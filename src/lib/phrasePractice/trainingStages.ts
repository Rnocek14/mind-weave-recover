/**
 * Phrase Practice: eight actual SCRIPT and SITUATIONAL PRACTICE modes
 * across existing authored difficulty bands. These are training tasks,
 * not verified clinical recovery/milestones; SLP review remains outstanding.
 */
import { getTrialsForLevel, type PhraseTrial } from '@/data/phraseBank';

export interface PhraseTrainingStage {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  label: string;
  engineLevel: 1 | 3 | 5 | 7 | 9;
  mode: 'modeled' | 'completion' | 'key_words' | 'scenario' | 'repair';
  autoModel: boolean;
}

const MODES: Readonly<Record<PhraseTrainingStage['level'], PhraseTrainingStage>> = {
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
  4: {
    level: 4,
    label: 'Hear and repeat a complete functional request',
    engineLevel: 5,
    mode: 'modeled',
    autoModel: true,
  },
  5: {
    level: 5,
    label: 'Complete a longer everyday request',
    engineLevel: 7,
    mode: 'completion',
    autoModel: false,
  },
  6: {
    level: 6,
    label: 'Recall a longer request from keyword hints',
    engineLevel: 7,
    mode: 'key_words',
    autoModel: false,
  },
  7: {
    level: 7,
    label: 'Choose what to say in a real situation',
    engineLevel: 9,
    mode: 'scenario',
    autoModel: false,
  },
  8: {
    level: 8,
    label: 'Repair a misunderstanding in conversation',
    engineLevel: 9,
    mode: 'repair',
    autoModel: false,
  },
};

/** Higher persisted levels are NEVER disguised as a supported script mode. */
export function getPhraseTrainingStage(level: number | null | undefined): PhraseTrainingStage | null {
  if (level == null || !Number.isInteger(level) || level < 1 || level > 8) return null;
  return MODES[level as PhraseTrainingStage['level']];
}

export interface PhraseTrainingPrompt {
  title: string;
  text: string;
  fullPhraseRevealed: boolean;
  /** Every mode has lexical and/or model support; never independent mastery. */
  evidenceSupport: 'visible_script' | 'partial_script' | 'word_clues' | 'situational_prompt' | 'repair_prompt';
}

/**
 * Authored functional practice, from existing target phrases. Prompts never
 * show the target phrase before an explicit reveal. These contexts are
 * *not* validated independent conversation or transfer assessments.
 */
const SCENARIO_SCRIPTS: Readonly<Record<string, {situation:string; repair:string}>> = {
  worried_about: {situation:'You want to tell your care partner what concerns you about the future. What could you say?',repair:'A listener thinks you are only excited about the future. Gently correct them and express your concern.'},
  proud_progress: {situation:'You accomplished a difficult task today. Tell your family how you feel about that progress.',repair:'Someone thinks today went badly. Clarify how you feel about the progress you made.'},
  need_talk: {situation:'You have an important subject to discuss with a family member. How could you start?',repair:'The listener thinks you are making small talk. Clarify that this subject matters to you.'},
  hard_find_words: {situation:'You have a thought but the words will not come easily. Explain what is happening.',repair:'The listener thinks you did not understand them. Explain that finding words is the difficult part.'},
  appreciate_patience: {situation:'Someone gives you extra time to answer. Tell them what that means to you.',repair:'The listener says they feel they are holding you up. Thank them for waiting patiently.'},
  getting_better_everyday: {situation:'You want to share a hopeful thought about making small improvements over time.',repair:'Someone thinks you said you never improve. Clarify what you are noticing over time.'},
  want_do_myself: {situation:'A family member offers to complete a task for you, but you want to try independently.',repair:'The helper misunderstands and starts doing the task for you. Explain that you want to try.'},
  miss_way_things: {situation:'You are thinking about how everyday life used to feel. Tell someone what you miss.',repair:'Someone thinks you are unhappy with them personally. Clarify that you miss the way things used to be.'},
  proud_myself_today: {situation:'After a challenging practice session, tell someone how you feel about trying.',repair:'The listener thinks you are discouraged today. Clarify how you feel about your own effort.'},
  explain_doctor_clearly: {situation:'Before a medical appointment, tell your care partner what you hope to do in the conversation.',repair:'Someone offers to speak for you at your appointment. Explain what you want to do yourself.'},
  frustrated_but_not_giving_up: {situation:'Practice feels difficult, but you plan to continue. Tell your care partner both feelings.',repair:'The listener assumes frustration means you want to quit. Correct that misunderstanding.'},
  remember_when_we_used: {situation:'Looking at an old family photograph, begin telling someone a shared memory.',repair:'The listener thinks you are describing only today. Begin a memory from the past instead.'},
  celebrate_small_progress: {situation:'A small thing went well today. Tell someone what recognizing that success feels like.',repair:'Someone says a small achievement does not matter. Explain how you feel about celebrating it.'},
  keep_going_one_step: {situation:'An activity seems too big to do all at once. Tell yourself the approach you plan to take.',repair:'The listener thinks you want to do everything at once. Clarify how you intend to proceed.'},
};

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
  if (stage.mode === 'scenario' || stage.mode === 'repair') {
    const scene = SCENARIO_SCRIPTS[(trial as PhraseTrial).id];
    if (!scene) {
      // Never fabricate a target-free scenario for an unsupported phrase.
      return {title:'Practice this phrase',text:trial.phrase,
        fullPhraseRevealed:true,evidenceSupport:'visible_script'};
    }
    return {
      title:stage.mode === 'scenario' ? 'What would you say?' : 'Help the listener understand you',
      text:stage.mode === 'scenario' ? scene.situation : scene.repair,
      fullPhraseRevealed:false,
      evidenceSupport:stage.mode === 'scenario' ? 'situational_prompt' : 'repair_prompt',
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
    : (stage.mode === 'scenario' || stage.mode === 'repair')
      ? Math.max(count,14) : count);
  const playable = stage.mode === 'completion'
    ? pool.filter(trial => trial.phrase.trim().split(/\s+/).filter(Boolean).length >= 2)
    : stage.mode === 'key_words'
      ? pool.filter(trial => (trial.cueWords ?? []).some(cue => !!cue.trim()))
      : stage.mode === 'scenario' || stage.mode === 'repair'
        ? pool.filter(trial => !!SCENARIO_SCRIPTS[trial.id])
        : pool;
  // Do not fall back silently to the wrong task or invent a target.
  return playable.slice(0, count);
}

/** A care-partner selection changes practice, not the patient's saved level. */
export function resolvePhrasePracticeStage(
  savedStage: PhraseTrainingStage | null,
  practiceOverride: PhraseTrainingStage['level'] | null | undefined,
): PhraseTrainingStage | null {
  return practiceOverride == null ? savedStage : getPhraseTrainingStage(practiceOverride);
}
