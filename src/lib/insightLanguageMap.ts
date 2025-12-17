/**
 * Plain-Language Mapping for Clinical Terms
 * 
 * Converts clinical/research terminology into patient-friendly language
 * while preserving clinical terms for clinician tooltips.
 */

export interface TermMapping {
  label: string;           // Patient-facing label
  description: string;     // Short explanation
  clinicalTerm: string;    // Tooltip for clinicians
}

// Error type mappings
export const errorTypeMap: Record<string, TermMapping> = {
  semantic_paraphasia: {
    label: "Related word mix-ups",
    description: "Saying a word that's related, like 'fork' instead of 'spoon'.",
    clinicalTerm: "Semantic paraphasia"
  },
  phonemic_paraphasia: {
    label: "Sound mix-ups",
    description: "Getting some sounds wrong, like 'gat' instead of 'cat'.",
    clinicalTerm: "Phonemic paraphasia"
  },
  circumlocution: {
    label: "Talking around the word",
    description: "Describing something instead of saying the word directly.",
    clinicalTerm: "Circumlocution"
  },
  neologism: {
    label: "Made-up words",
    description: "Creating new words that aren't quite right.",
    clinicalTerm: "Neologism"
  },
  no_response: {
    label: "No response",
    description: "Couldn't find any words in time.",
    clinicalTerm: "No response"
  },
  timeout: {
    label: "Needed more time",
    description: "Ran out of time before answering.",
    clinicalTerm: "Timeout"
  },
  attempted: {
    label: "Good try",
    description: "Made an attempt that was close but not quite right.",
    clinicalTerm: "Attempted response"
  },
  correct: {
    label: "Correct",
    description: "Got it right!",
    clinicalTerm: "Correct response"
  }
};

// Cue type mappings
export const cueTypeMap: Record<string, TermMapping> = {
  semantic: {
    label: "Category hints",
    description: "Hints about what group or type the word belongs to.",
    clinicalTerm: "Semantic cue"
  },
  phonemic: {
    label: "Sound hints",
    description: "Hints about how the word starts or sounds.",
    clinicalTerm: "Phonemic cue"
  },
  full_word: {
    label: "Full word",
    description: "Hearing the complete word to repeat.",
    clinicalTerm: "Full word model"
  },
  none: {
    label: "No hint",
    description: "Answered without any hints.",
    clinicalTerm: "No cue"
  }
};

// Challenge category mappings
export const challengeCategoryMap: Record<string, TermMapping> = {
  animals: {
    label: "Animal names",
    description: "Words for different animals.",
    clinicalTerm: "Animals category"
  },
  food: {
    label: "Food words",
    description: "Names of foods and drinks.",
    clinicalTerm: "Food category"
  },
  household: {
    label: "Household items",
    description: "Things found around the home.",
    clinicalTerm: "Household objects"
  },
  body_parts: {
    label: "Body parts",
    description: "Parts of the body.",
    clinicalTerm: "Body parts category"
  },
  actions: {
    label: "Action words",
    description: "Words for things people do.",
    clinicalTerm: "Verbs/Actions"
  },
  unknown: {
    label: "Mixed words",
    description: "Various word types.",
    clinicalTerm: "Uncategorized"
  }
};

/**
 * Get patient-friendly label for an error type
 */
export function getErrorLabel(errorType: unknown): string {
  if (typeof errorType !== 'string' || !errorType) return "Unknown";
  const mapping = errorTypeMap[errorType.toLowerCase()];
  return mapping?.label || formatFallback(errorType);
}

/**
 * Get patient-friendly label for a cue type
 */
export function getCueLabel(cueType: unknown): string {
  if (typeof cueType !== 'string' || !cueType) return "No hint";
  const mapping = cueTypeMap[cueType.toLowerCase()];
  return mapping?.label || formatFallback(cueType);
}

/**
 * Get full term info for displaying with tooltips
 */
export function getErrorTermInfo(errorType: unknown): TermMapping {
  if (typeof errorType !== 'string' || !errorType) {
    return { label: "Unknown", description: "", clinicalTerm: "Unknown" };
  }
  const mapping = errorTypeMap[errorType.toLowerCase()];
  return mapping || {
    label: formatFallback(errorType),
    description: "",
    clinicalTerm: errorType
  };
}

/**
 * Get full cue term info for displaying with tooltips
 */
export function getCueTermInfo(cueType: unknown): TermMapping {
  if (typeof cueType !== 'string' || !cueType) {
    return { label: "No hint", description: "", clinicalTerm: "No cue" };
  }
  const mapping = cueTypeMap[cueType.toLowerCase()];
  return mapping || {
    label: formatFallback(cueType),
    description: "",
    clinicalTerm: cueType
  };
}

/**
 * Audio "listen for" hints by error type - makes evidence self-explanatory
 */
const listenForHints: Record<string, string> = {
  semantic_paraphasia: "a word that's related but not the target",
  phonemic_paraphasia: "the first sound being changed or missing",
  circumlocution: "describing instead of naming",
  neologism: "a made-up or unfamiliar word",
  no_response: "long pauses or no answer",
  timeout: "running out of time",
  attempted: "a close but not quite right attempt",
  correct: "clear, accurate pronunciation"
};

/**
 * Get "listen for" hint for audio playback context
 */
export function getListenForHint(errorType: unknown): string {
  if (typeof errorType !== 'string' || !errorType) return "the response";
  return listenForHints[errorType.toLowerCase()] || "the response";
}

/**
 * Format a raw enum value as a fallback label
 */
function formatFallback(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
