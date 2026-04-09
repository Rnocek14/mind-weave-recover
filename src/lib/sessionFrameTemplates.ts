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

// ─── Template Registry ──────────────────────────────────────────────

const TEMPLATES: Record<string, SessionFrameTemplate> = {
  core_communication: CORE_COMMUNICATION,
};

export function getSessionFrame(templateId: string): SessionFrameTemplate | null {
  return TEMPLATES[templateId] || null;
}

export function getAllSessionFrameIds(): string[] {
  return Object.keys(TEMPLATES);
}
