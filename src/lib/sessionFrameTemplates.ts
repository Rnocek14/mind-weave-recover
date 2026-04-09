/**
 * Session Frame Templates — Maya-led session framing for guided therapy.
 * 
 * Each template defines:
 * - sessionTheme: human label for the session type
 * - mayaIntro: text shown before first exercise
 * - mayaTransitions: text shown between exercises (keyed by "from→to" exercise pair)
 * - closingBuilder: function that derives cross-exercise insights from real performance
 * 
 * Designed so future templates (Expression-Focused, Low-Energy) plug in without
 * modifying LessonFlow or SessionSummaryScreen.
 */

export interface SessionFrameClosing {
  practiced: string[];
  strength: string;
  nextStep: string;
  realLifeLine: string;
}

export interface SessionFrameTemplate {
  id: string;
  sessionTheme: string;
  mayaIntro: string;
  /** Keyed by blockIndex (0, 1, 2...) — the transition shown BEFORE that block */
  mayaTransitions: Record<number, string>;
  /** Build closing reflection from actual exercise results */
  closingBuilder: (blockResults: BlockResult[]) => SessionFrameClosing;
}

export interface BlockResult {
  exerciseId: string;
  avgScore: number;
  trialCount: number;
  /** Exercise-specific outputs (e.g., clue types, story coverage) */
  details?: Record<string, any>;
}

// ─── Core Communication Template ────────────────────────────────────

function buildCoreCommunicationClosing(results: BlockResult[]): SessionFrameClosing {
  const detective = results.find(r => r.exerciseId === 'detective-mind');
  const narrative = results.find(r => r.exerciseId === 'narrative-retell');
  
  const practiced: string[] = [];
  if (detective) practiced.push('finding clues in stories');
  if (narrative) practiced.push('retelling a story in order');
  
  // Derive strength from actual performance
  let strength = 'staying focused through multiple exercises';
  let nextStep = 'keep building consistency across exercises';
  
  if (detective && narrative) {
    const detScore = detective.avgScore;
    const narScore = narrative.avgScore;
    
    if (detScore >= 70 && narScore >= 70) {
      strength = 'strong comprehension and clear retelling';
      nextStep = 'try retelling with more detail in the middle of stories';
    } else if (detScore >= 70 && narScore < 70) {
      strength = 'catching important details and clues';
      nextStep = 'work on organizing the story when telling it back';
    } else if (detScore < 70 && narScore >= 70) {
      strength = 'telling the story back clearly';
      nextStep = 'focus on identifying the key clues before retelling';
    } else {
      strength = 'sticking with challenging material';
      nextStep = 'build up comprehension with shorter, simpler stories';
    }
  } else if (detective) {
    strength = detective.avgScore >= 70 
      ? 'identifying key details accurately' 
      : 'working through challenging clue-finding';
    nextStep = 'connect clue-finding to retelling stories';
  } else if (narrative) {
    strength = narrative.avgScore >= 70 
      ? 'clear story organization' 
      : 'attempting to sequence story events';
    nextStep = 'practice finding clues before retelling';
  }
  
  return {
    practiced,
    strength,
    nextStep,
    realLifeLine: 'These are the same skills you use when following conversations and explaining what happened during your day.',
  };
}

const CORE_COMMUNICATION: SessionFrameTemplate = {
  id: 'core_communication',
  sessionTheme: 'Core Communication',
  mayaIntro: "Today we'll practice understanding a short story, finding the important clues, and then telling it back clearly.",
  mayaTransitions: {
    // Transition shown before block index 1 (i.e., after Detective Mind, before Narrative Retell)
    1: "You found the important clues. Now let's use that same skill to tell the story back.",
  },
  closingBuilder: buildCoreCommunicationClosing,
};

// ─── Expression-Focused Template ────────────────────────────────────

function buildExpressionClosing(results: BlockResult[]): SessionFrameClosing {
  const practiced: string[] = [];
  const exerciseMap: Record<string, string> = {
    'semantic-features': 'describing word features',
    'synonym-generator': 'finding related words',
    'category-fluency': 'generating words by category',
    'photo-naming': 'naming from pictures',
  };
  for (const r of results) {
    if (exerciseMap[r.exerciseId]) practiced.push(exerciseMap[r.exerciseId]);
  }

  const avgScore = results.length > 0
    ? results.reduce((s, r) => s + r.avgScore, 0) / results.length
    : 50;

  let strength = 'working on word retrieval skills';
  let nextStep = 'keep building naming speed and accuracy';

  if (avgScore >= 70) {
    strength = 'strong word-finding across multiple exercises';
    nextStep = 'try using these words in full sentences';
  } else if (avgScore >= 50) {
    strength = 'engaging with word retrieval challenges';
    nextStep = 'slow down and use feature descriptions to help find words';
  }

  return {
    practiced,
    strength,
    nextStep,
    realLifeLine: 'These are the same skills you use when you want to say a specific word in conversation.',
  };
}

const EXPRESSION_FOCUSED: SessionFrameTemplate = {
  id: 'expression_focused',
  sessionTheme: 'Expression Focus',
  mayaIntro: "Today we'll work on getting the right words out — describing, naming, and finding related words.",
  mayaTransitions: {
    1: "Good work describing those features. Now let's use that skill to find related words.",
    2: "Now let's try generating words quickly by category.",
  },
  closingBuilder: buildExpressionClosing,
};

// ─── Comprehension-Focused Template ─────────────────────────────────

function buildComprehensionClosing(results: BlockResult[]): SessionFrameClosing {
  const practiced: string[] = [];
  const exerciseMap: Record<string, string> = {
    'detective-mind': 'finding clues in stories',
    'meaning-match': 'matching word meanings',
    'narrative-retell': 'retelling a story in order',
  };
  for (const r of results) {
    if (exerciseMap[r.exerciseId]) practiced.push(exerciseMap[r.exerciseId]);
  }

  const avgScore = results.length > 0
    ? results.reduce((s, r) => s + r.avgScore, 0) / results.length
    : 50;

  let strength = 'working through comprehension exercises';
  let nextStep = 'focus on catching key details while reading';

  if (avgScore >= 70) {
    strength = 'solid understanding across reading and listening';
    nextStep = 'try catching more subtle or implied details';
  } else if (avgScore >= 50) {
    strength = 'engaging with comprehension challenges';
    nextStep = 'try re-reading key sentences before answering';
  }

  return {
    practiced,
    strength,
    nextStep,
    realLifeLine: 'These skills help you follow conversations, understand instructions, and catch important details.',
  };
}

const COMPREHENSION_FOCUSED: SessionFrameTemplate = {
  id: 'comprehension_focused',
  sessionTheme: 'Comprehension Focus',
  mayaIntro: "Today we'll focus on understanding — catching details, making connections, and following stories.",
  mayaTransitions: {
    1: "You found the key clues. Now let's work on matching word meanings.",
    2: "Good. Now let's put it all together by retelling a story.",
  },
  closingBuilder: buildComprehensionClosing,
};

// ─── Low-Energy Template ────────────────────────────────────────────

function buildLowEnergyClosing(results: BlockResult[]): SessionFrameClosing {
  const practiced: string[] = [];
  for (const r of results) {
    const label = r.exerciseId.replace(/-/g, ' ');
    practiced.push(label);
  }

  return {
    practiced,
    strength: 'showing up and staying consistent',
    nextStep: 'keep the daily habit going — even short sessions count',
    realLifeLine: 'Every session strengthens the pathways you need for daily communication.',
  };
}

const LOW_ENERGY: SessionFrameTemplate = {
  id: 'low_energy',
  sessionTheme: 'Light Session',
  mayaIntro: "Let's keep it short and focused today. A little practice goes a long way.",
  mayaTransitions: {
    1: "One more quick exercise, then we'll wrap up.",
  },
  closingBuilder: buildLowEnergyClosing,
};

// ─── General Session Template (dynamic/adaptive lessons) ────────────

function buildGeneralClosing(results: BlockResult[]): SessionFrameClosing {
  const practiced: string[] = [];
  for (const r of results) {
    const label = r.exerciseId.replace(/-/g, ' ');
    practiced.push(label);
  }

  const avgScore = results.length > 0
    ? results.reduce((s, r) => s + r.avgScore, 0) / results.length
    : 50;

  let strength = 'staying focused across multiple exercises';
  let nextStep = 'keep building consistency';

  if (avgScore >= 70) {
    strength = 'strong performance across the session';
    nextStep = 'try pushing for more detail and speed next time';
  } else if (avgScore >= 50) {
    strength = 'engaging with challenging material';
    nextStep = 'focus on the exercises that felt hardest';
  }

  return {
    practiced,
    strength,
    nextStep,
    realLifeLine: 'Every session strengthens the skills you use in daily conversations.',
  };
}

/** Build dynamic Maya transitions based on the actual exercise blocks.
 *  Each transition has: reflection on what was just practiced + purpose of what's next.
 */
function buildDynamicTransitions(blocks: { exerciseId: string; priority?: string }[]): Record<number, string> {
  const transitions: Record<number, string> = {};
  
  const EXERCISE_BRIDGES: Record<string, { reflection: string; purpose: string }> = {
    'category-fluency': {
      reflection: 'That warmed up your word-finding speed.',
      purpose: 'Let\'s work on finding words quickly by category.',
    },
    'photo-naming': {
      reflection: 'Good practice connecting pictures to words.',
      purpose: 'Now let\'s practice naming what you see.',
    },
    'describe-guess': {
      reflection: 'Nice — describing things uses the same skills as everyday conversation.',
      purpose: 'Now let\'s practice describing things in detail.',
    },
    'narrative-retell': {
      reflection: 'Good work organizing that story. Retelling builds your sequencing skills.',
      purpose: 'Now let\'s practice telling a story back in your own words.',
    },
    'detective-mind': {
      reflection: 'Good detective work. Catching key details builds your comprehension.',
      purpose: 'Now let\'s read a story and find the important clues.',
    },
    'two-clues': {
      reflection: 'Good — combining clues to find a word is like solving puzzles in conversation.',
      purpose: 'Now let\'s figure out words from two clues.',
    },
    'synonym-generator': {
      reflection: 'Nice — having multiple words for the same idea makes speaking easier.',
      purpose: 'Now let\'s find different words that mean the same thing.',
    },
    'thought-continuation': {
      reflection: 'Good thinking. Finishing thoughts naturally keeps conversations flowing.',
      purpose: 'Now let\'s practice finishing sentences naturally.',
    },
    'meaning-match': {
      reflection: 'Good — understanding word meanings helps you follow conversations better.',
      purpose: 'Now let\'s match words to their meanings.',
    },
    'abstract-compare': {
      reflection: 'Nice work. Comparing things uses deep thinking skills.',
      purpose: 'Now let\'s think about how things are similar.',
    },
    'semantic-features': {
      reflection: 'Good work describing those features. That helps with word-finding.',
      purpose: 'Now let\'s describe what makes things unique.',
    },
    'fix-sentence': {
      reflection: 'Good — catching sentence errors builds your grammar sense.',
      purpose: 'Now let\'s practice fixing sentences that have a wrong word.',
    },
    'sentence-construction': {
      reflection: 'Good practice building sentences. That helps with speaking in order.',
      purpose: 'Now let\'s build some sentences from scrambled words.',
    },
    'minimal-pairs': {
      reflection: 'Good listening. Telling similar sounds apart is important for understanding speech.',
      purpose: 'Now let\'s practice hearing the difference between similar sounds.',
    },
    'dual-load-naming': {
      reflection: 'Good multitasking. That builds real-world conversation stamina.',
      purpose: 'Now let\'s name things while holding something else in mind.',
    },
    'multi-step-plan': {
      reflection: 'Good planning. Organizing steps helps with everyday tasks.',
      purpose: 'Now let\'s practice planning steps in order.',
    },
  };

  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const next = blocks[i];
    const prevBridge = EXERCISE_BRIDGES[prev.exerciseId];
    const nextBridge = EXERCISE_BRIDGES[next.exerciseId];
    
    const reflectionPart = prevBridge?.reflection || 'Good work on that.';
    const purposePart = nextBridge?.purpose || `Let's move to the next exercise.`;
    
    transitions[i] = `${reflectionPart} ${purposePart}`;
  }
  
  return transitions;
}

const GENERAL_SESSION: SessionFrameTemplate = {
  id: 'general_session',
  sessionTheme: 'Today\'s Practice',
  mayaIntro: "Welcome back. Let's warm up and then build on your skills today.",
  mayaTransitions: {}, // Will be dynamically populated
  closingBuilder: buildGeneralClosing,
};

// ─── Template Registry ──────────────────────────────────────────────

const TEMPLATES: Record<string, SessionFrameTemplate> = {
  core_communication: CORE_COMMUNICATION,
  expression_focused: EXPRESSION_FOCUSED,
  comprehension_focused: COMPREHENSION_FOCUSED,
  low_energy: LOW_ENERGY,
  general_session: GENERAL_SESSION,
};

export function getSessionFrame(templateId: string): SessionFrameTemplate | null {
  return TEMPLATES[templateId] || null;
}

/** Get or create a session frame, with dynamic transitions for general sessions */
export function getOrCreateSessionFrame(templateId: string | undefined, blocks: { exerciseId: string; priority?: string }[]): SessionFrameTemplate | null {
  if (templateId) {
    const frame = TEMPLATES[templateId];
    if (frame) {
      // If it's the general template, dynamically populate transitions
      if (templateId === 'general_session') {
        return { ...frame, mayaTransitions: buildDynamicTransitions(blocks) };
      }
      // For specific templates, fill in any missing transitions dynamically
      const dynamicTransitions = buildDynamicTransitions(blocks);
      const merged = { ...dynamicTransitions, ...frame.mayaTransitions };
      return { ...frame, mayaTransitions: merged };
    }
  }
  // No template specified — create a general one with dynamic transitions
  return { ...GENERAL_SESSION, mayaTransitions: buildDynamicTransitions(blocks) };
}

export function getAllSessionFrameIds(): string[] {
  return Object.keys(TEMPLATES);
}
