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

// ─── Template Registry ──────────────────────────────────────────────

const TEMPLATES: Record<string, SessionFrameTemplate> = {
  core_communication: CORE_COMMUNICATION,
  expression_focused: EXPRESSION_FOCUSED,
  comprehension_focused: COMPREHENSION_FOCUSED,
  low_energy: LOW_ENERGY,
};

export function getSessionFrame(templateId: string): SessionFrameTemplate | null {
  return TEMPLATES[templateId] || null;
}

export function getAllSessionFrameIds(): string[] {
  return Object.keys(TEMPLATES);
}
