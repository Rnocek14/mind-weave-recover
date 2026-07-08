// _shared/crisisDetection.ts — lightweight, dependency-free safety classifier
// for conversational surfaces used by stroke survivors.
//
// The conversation/coach prompts optimize purely for keeping the conversational
// floor open. That is dangerous when a user expresses self-harm intent, acute
// distress, or acute stroke symptoms (a possible recurrent stroke). This module
// detects those cases so the caller can break the normal turn loop and surface
// emergency guidance instead of a cheerful follow-up question.
//
// It is intentionally high-recall (better to over-trigger a safety message than
// miss a real emergency). It is NOT a diagnosis — just a routing signal.

export type CrisisKind = "self_harm" | "medical_emergency";

const SELF_HARM_PATTERNS: RegExp[] = [
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be here|go on)\b/i,
  /\bhurt(ing)?\s+my\s?self\b/i,
  /\bharm(ing)?\s+my\s?self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+(dead|without me)\b/i,
];

// Acute stroke / medical-emergency red flags (FAST + common acute symptoms).
const MEDICAL_EMERGENCY_PATTERNS: RegExp[] = [
  /\bhaving\s+(a|another)\s+stroke\b/i,
  /\bface\s+(is\s+)?(drooping|dropping|numb)\b/i,
  /\b(can'?t|cannot|unable to)\s+(move|feel)\s+(my\s+)?(arm|leg|face|side|hand)\b/i,
  /\b(arm|leg|face|hand)\s+(is\s+)?(numb|weak|paralyzed)\b/i,
  /\bslurr(ed|ing)\s+(speech|words)\b/i,
  /\bsudden(ly)?\s+(confused|dizzy|blurry|blind)\b/i,
  /\bchest\s+pain\b/i,
  /\b(can'?t|cannot|struggling to)\s+breathe\b/i,
  /\bworst\s+headache\b/i,
  /\bcall\s+9\s?1\s?1\b/i,
  /\bcall\s+an?\s+ambulance\b/i,
];

export interface CrisisResult {
  isCrisis: boolean;
  kind?: CrisisKind;
}

export function detectCrisis(text: string | null | undefined): CrisisResult {
  if (!text || typeof text !== "string") return { isCrisis: false };
  const t = text.toLowerCase();
  if (SELF_HARM_PATTERNS.some((re) => re.test(t))) {
    return { isCrisis: true, kind: "self_harm" };
  }
  if (MEDICAL_EMERGENCY_PATTERNS.some((re) => re.test(t))) {
    return { isCrisis: true, kind: "medical_emergency" };
  }
  return { isCrisis: false };
}

/** A calm, fixed safety message. NEVER routed through the LLM. */
export function crisisSafetyMessage(kind: CrisisKind): string {
  if (kind === "medical_emergency") {
    return "This sounds like it could be a medical emergency. Please stop and get help right now — call your local emergency number (911 in the US) or have someone nearby call for you. If you can, contact your care team too.";
  }
  return "I'm really glad you told me. You deserve support right now. If you might be in danger, please call your local emergency number (911 in the US) or a crisis line (in the US, call or text 988). If you can, reach out to someone you trust or your care team.";
}
