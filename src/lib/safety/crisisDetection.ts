/**
 * Client-side crisis detection — browser port of
 * supabase/functions/_shared/crisisDetection.ts (keep the pattern lists in
 * sync with that module).
 *
 * The conversational edge functions gate their own turns, but most
 * free-speech surfaces (narrative retell, category fluency, multi-step
 * planning, describe & guess…) score locally and never pass the transcript
 * through a gated function. This module lets the shared speech-recognition
 * hook surface the same fixed emergency guidance the moment a final
 * transcript matches, on every speech surface at once.
 *
 * Deliberately high-recall (better to over-show a supportive message than
 * miss a real emergency) and NOT a diagnosis — just a routing signal.
 * Surfacing is strictly additive: it never alters scoring, adaptation, or
 * exercise flow.
 */

import { toast } from 'sonner';

export type CrisisKind = 'self_harm' | 'medical_emergency';

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
  if (!text || typeof text !== 'string') return { isCrisis: false };
  const t = text.toLowerCase();
  if (SELF_HARM_PATTERNS.some((re) => re.test(t))) {
    return { isCrisis: true, kind: 'self_harm' };
  }
  if (MEDICAL_EMERGENCY_PATTERNS.some((re) => re.test(t))) {
    return { isCrisis: true, kind: 'medical_emergency' };
  }
  return { isCrisis: false };
}

/** A calm, fixed safety message. NEVER routed through an LLM. */
export function crisisSafetyMessage(kind: CrisisKind): string {
  if (kind === 'medical_emergency') {
    return 'This sounds like it could be a medical emergency. Please stop and get help right now — call your local emergency number (911 in the US) or have someone nearby call for you. If you can, contact your care team too.';
  }
  return "I'm really glad you told me. You deserve support right now. If you might be in danger, please call your local emergency number (911 in the US) or a crisis line (in the US, call or text 988). If you can, reach out to someone you trust or your care team.";
}

// Re-showing the same notice on every recognizer restart would nag; one
// notice per kind per cooldown window is enough. The toast id also dedupes
// a notice that is still on screen.
const NOTICE_COOLDOWN_MS = 60_000;
const lastShownAt: Partial<Record<CrisisKind, number>> = {};

/** Show the fixed safety guidance as a persistent, dismissible notice. */
export function showCrisisSafetyNotice(kind: CrisisKind): void {
  try {
    const now = Date.now();
    const last = lastShownAt[kind] ?? 0;
    if (now - last < NOTICE_COOLDOWN_MS) return;
    lastShownAt[kind] = now;
    toast.warning(crisisSafetyMessage(kind), {
      id: `crisis-safety-${kind}`,
      duration: 60_000,
    });
  } catch {
    // Surfacing is best-effort and must never break the caller.
  }
}

/**
 * Check a final transcript and surface the safety notice on a match.
 * Additive only — never throws, never returns anything callers act on.
 */
export function maybeSurfaceCrisisNotice(transcript: string | null | undefined): void {
  try {
    const crisis = detectCrisis(transcript);
    if (crisis.isCrisis && crisis.kind) {
      showCrisisSafetyNotice(crisis.kind);
    }
  } catch {
    // Never break speech recognition over a safety-notice failure.
  }
}
