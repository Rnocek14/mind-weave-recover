/**
 * EchoFilter — rejects user transcripts that are echoes of Maya's recent speech.
 *
 * Wave 1 of the clinical engine hardening pass.
 *
 * The existing `responseValidation.ts` only catches a static bank of
 * instruction phrases. EchoFilter is dynamic: it pulls the *actual* last
 * 5 lines Maya spoke from the VoiceController and rejects:
 *   1. Exact normalized matches
 *   2. ≥0.7 Jaccard token overlap on content tokens
 *   3. ≥0.85 character-trigram similarity (catches near-paraphrases)
 *   4. Short-phrase mimicry ("what you see", "say what you see", etc.)
 *
 * Returns { isEcho: true, matched: <line>, score: <0-1> } when rejected.
 */

import { voiceController } from '@/lib/voiceController';

const STOPWORDS = new Set([
  'the','a','an','is','it','to','of','in','on','at','for','and','or','but','i','you','me','my','your',
  'this','that','these','those','what','do','does','did','can','could','please','um','uh','er','ah','well','so',
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function trigrams(s: string): Set<string> {
  const n = normalize(s);
  if (n.length < 3) return new Set([n]);
  const out = new Set<string>();
  for (let i = 0; i <= n.length - 3; i++) out.add(n.slice(i, i + 3));
  return out;
}

function trigramSim(a: string, b: string): number {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

export interface EchoFilterResult {
  isEcho: boolean;
  matched: string | null;
  score: number;
  reason: 'exact' | 'token_overlap' | 'trigram' | 'short_mimic' | null;
}

const SHORT_MIMIC_RE = /^(what (do )?you see|say what you see|tell me|describe (it|this)|what is (it|this)|name (it|this)|finish (the )?thought|fix (the )?sentence)[.!?\s]*$/i;

export function checkEcho(transcript: string, extraSpoken: string[] = []): EchoFilterResult {
  const t = transcript.trim();
  if (!t) return { isEcho: false, matched: null, score: 0, reason: null };

  // Short-phrase mimicry — instant reject regardless of history
  if (SHORT_MIMIC_RE.test(t.replace(/[.,!?]+$/, ''))) {
    return { isEcho: true, matched: t, score: 1, reason: 'short_mimic' };
  }

  const userTokens = tokens(t);
  const userNorm = normalize(t);

  // Pull live Maya history + any extras the caller wants checked (e.g. current prompt)
  const history = [...voiceController.getRecentSpoken(), ...extraSpoken];
  if (!history.length) return { isEcho: false, matched: null, score: 0, reason: null };

  let best: EchoFilterResult = { isEcho: false, matched: null, score: 0, reason: null };

  for (const line of history) {
    const lineNorm = normalize(line);
    if (!lineNorm) continue;

    // 1. Exact (after normalization)
    if (lineNorm === userNorm) {
      return { isEcho: true, matched: line, score: 1, reason: 'exact' };
    }

    // 2. Token-overlap Jaccard on content tokens
    const lineTokens = tokens(line);
    const j = jaccard(userTokens, lineTokens);
    if (j >= 0.7 && userTokens.length >= 2) {
      if (j > best.score) best = { isEcho: true, matched: line, score: j, reason: 'token_overlap' };
    }

    // 3. Character trigram similarity (catches near-paraphrases / partial echoes)
    //    Only fires when user input is short-to-medium; long discourse should not
    //    be flagged as an echo of an instruction.
    if (userNorm.length <= 80) {
      const tg = trigramSim(userNorm, lineNorm);
      if (tg >= 0.85) {
        if (tg > best.score) best = { isEcho: true, matched: line, score: tg, reason: 'trigram' };
      }
    }
  }

  return best;
}
