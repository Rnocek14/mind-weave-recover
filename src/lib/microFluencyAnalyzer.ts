/**
 * Micro-Fluency Analysis (Phase 2)
 * 
 * Derives detailed fluency metrics from MFA alignment data:
 * - Silent pauses from word boundary gaps
 * - Filled pauses from transcript tokens
 * - Pre-word pauses (before content words)
 * - Intra-word pauses (silence inside word windows - apraxia signal)
 * - Phrase breaks and burst counts
 */

export type AlignmentWord = { 
  word: string; 
  start: number; 
  end: number; 
  duration: number;
};

export type AlignmentPhone = { 
  phone: string; 
  start: number; 
  end: number; 
  duration: number; 
  is_silence: boolean;
};

export interface AlignmentData {
  word_segments: AlignmentWord[];
  phone_segments: AlignmentPhone[];
  alignment_quality?: {
    word_count: number;
    phone_count: number;
    speech_phone_count: number;
    silence_phone_count: number;
    has_words: boolean;
    has_phones: boolean;
    speech_duration_sec: number;
    total_span_sec: number;
  };
}

export interface MicroFluencyAnalysis {
  silentPauses: { count: number; totalMs: number; avgMs: number };
  filledPauses: { count: number; tokens: string[] };
  preWordPauses: { count: number; avgMs: number; examples: string[] };
  intraWordPauses: { count: number; words: string[] };
  phraseBreaks: { count: number; avgMs: number };
  burstCount: number;
  longestPauseMs: number;
  notes: string[];
  quality: { alignmentOk: boolean; reason?: string };
}

const DEFAULT_FILLERS = new Set([
  "um", "uh", "erm", "er", "ah", "eh", "hmm", "mm", "mhm", "uhh", "umm",
  "like", "you know"
]);

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at", "for", "with", "as",
  "is", "are", "was", "were", "be", "been", "being", "i", "you", "he", "she", "we", "they",
  "it", "this", "that", "these", "those", "my", "your", "his", "her", "our", "their"
]);

function normToken(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, "")
    .trim();
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

export interface DeriveMicroFluencyOptions {
  pauseMinMs?: number;              // ignore micro-gaps smaller than this (default: 150)
  intraWordSilenceMinMs?: number;   // silence inside word window to count as intra-word (default: 120)
  phraseBreakMinMs?: number;        // classify pause as phrase break if >= this (default: 400)
  fillers?: Set<string>;
}

export function deriveMicroFluency(
  alignment: AlignmentData | null | undefined,
  transcriptRaw: string | null | undefined,
  opts?: DeriveMicroFluencyOptions
): MicroFluencyAnalysis {
  const pauseMinMs = opts?.pauseMinMs ?? 150;
  const intraWordSilenceMinMs = opts?.intraWordSilenceMinMs ?? 120;
  const phraseBreakMinMs = opts?.phraseBreakMinMs ?? 400;
  const fillers = opts?.fillers ?? DEFAULT_FILLERS;

  const notes: string[] = [];

  // Guard: missing alignment data
  if (!alignment?.word_segments?.length || !alignment?.phone_segments?.length) {
    return {
      silentPauses: { count: 0, totalMs: 0, avgMs: 0 },
      filledPauses: { count: 0, tokens: [] },
      preWordPauses: { count: 0, avgMs: 0, examples: [] },
      intraWordPauses: { count: 0, words: [] },
      phraseBreaks: { count: 0, avgMs: 0 },
      burstCount: 0,
      longestPauseMs: 0,
      notes: ["Alignment not available yet."],
      quality: { alignmentOk: false, reason: "Missing word_segments or phone_segments" }
    };
  }

  // Sort defensively
  const words = [...alignment.word_segments].sort((a, b) => a.start - b.start);
  const phones = [...alignment.phone_segments].sort((a, b) => a.start - b.start);

  // Basic quality checks
  const totalSpan = alignment.alignment_quality?.total_span_sec ?? 
    (words[words.length - 1].end - words[0].start);
  const speechDur = alignment.alignment_quality?.speech_duration_sec ?? totalSpan;
  
  if (totalSpan <= 0 || !Number.isFinite(totalSpan)) {
    return {
      silentPauses: { count: 0, totalMs: 0, avgMs: 0 },
      filledPauses: { count: 0, tokens: [] },
      preWordPauses: { count: 0, avgMs: 0, examples: [] },
      intraWordPauses: { count: 0, words: [] },
      phraseBreaks: { count: 0, avgMs: 0 },
      burstCount: 0,
      longestPauseMs: 0,
      notes: ["Alignment quality invalid (span <= 0)."],
      quality: { alignmentOk: false, reason: "Invalid alignment span" }
    };
  }

  // -------------------------
  // Filled pauses (token-based)
  // -------------------------
  const transcript = (transcriptRaw ?? "").toLowerCase();
  const filledTokens: string[] = [];
  
  if (transcript) {
    // greedy match for multiword filler "you know"
    const fillerList = Array.from(fillers).sort((a, b) => b.length - a.length);
    for (const f of fillerList) {
      if (!f) continue;
      const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = transcript.match(re);
      if (matches?.length) {
        for (let i = 0; i < matches.length; i++) filledTokens.push(f);
      }
    }
  }

  // ---------------------------------------
  // Silent pauses from word boundary gaps
  // ---------------------------------------
  const gapMs: number[] = [];
  const gapMeta: Array<{ ms: number; beforeWord: string; afterWord: string; afterIdx: number }> = [];

  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];
    const gapSec = b.start - a.end;
    if (!Number.isFinite(gapSec)) continue;
    const ms = gapSec * 1000;
    if (ms >= pauseMinMs) {
      gapMs.push(ms);
      gapMeta.push({ ms, beforeWord: a.word, afterWord: b.word, afterIdx: i + 1 });
    }
  }

  const totalSilent = gapMs.reduce((s, x) => s + x, 0);
  const longestPauseMs = gapMs.length ? Math.round(Math.max(...gapMs)) : 0;

  // Phrase breaks: long gaps
  const phraseBreakMs = gapMs.filter(ms => ms >= phraseBreakMinMs);
  const phraseBreakTotal = phraseBreakMs.reduce((s, x) => s + x, 0);

  // Burst count = segments of speech separated by phrase breaks
  const burstCount = words.length > 0 ? 1 + phraseBreakMs.length : 0;

  // ---------------------------------------
  // Pre-word pauses (pause before content-ish word)
  // ---------------------------------------
  const preWordPausesMs: number[] = [];
  const preWordExamples: string[] = [];

  for (const g of gapMeta) {
    const afterNorm = normToken(g.afterWord);
    if (!afterNorm) continue;

    // ignore if next word is a filler or stopword
    if (fillers.has(afterNorm) || STOPWORDS.has(afterNorm)) continue;

    preWordPausesMs.push(g.ms);
    if (preWordExamples.length < 5) {
      preWordExamples.push(`Pause ${Math.round(g.ms)}ms before "${afterNorm}"`);
    }
  }

  const preWordAvg = preWordPausesMs.length
    ? Math.round(preWordPausesMs.reduce((s, x) => s + x, 0) / preWordPausesMs.length)
    : 0;

  // ---------------------------------------
  // Intra-word pauses (silence phones inside a word time window)
  // ---------------------------------------
  const intraWordHits: string[] = [];
  let pIdx = 0;

  for (const w of words) {
    const wStart = w.start;
    const wEnd = w.end;

    // advance pointer past phones that end before word starts
    while (pIdx < phones.length && phones[pIdx].end <= wStart) pIdx++;

    let sawIntra = false;
    let j = pIdx;
    while (j < phones.length && phones[j].start < wEnd) {
      const ph = phones[j];
      if (ph.is_silence) {
        const overlapStart = Math.max(ph.start, wStart);
        const overlapEnd = Math.min(ph.end, wEnd);
        const overlapMs = (overlapEnd - overlapStart) * 1000;
        if (overlapMs >= intraWordSilenceMinMs) {
          sawIntra = true;
          break;
        }
      }
      j++;
    }

    if (sawIntra) {
      intraWordHits.push(normToken(w.word) || w.word);
    }
  }

  // ---------------------------------------
  // Notes / interpretation hints (clinician-side)
  // ---------------------------------------
  if (gapMs.length >= 3 && longestPauseMs >= 1000) {
    notes.push("Long silent pauses detected; consider lexical retrieval load or fatigue effects.");
  }
  
  const sortedPreWord = [...preWordPausesMs].sort((a, b) => a - b);
  const p90PreWord = percentile(sortedPreWord, 0.9);
  if (preWordPausesMs.length >= 2 && p90PreWord !== null && p90PreWord >= 800) {
    notes.push("Prominent pre-word pauses may indicate word-finding/selection difficulty.");
  }
  
  if (intraWordHits.length >= 1) {
    notes.push("Intra-word silence detected (possible motor planning/apraxia signal). Review affected targets.");
  }
  
  if (filledTokens.length >= 2) {
    notes.push("Filled pauses present; track changes over time alongside silent pause burden.");
  }

  // Quality gates
  const alignmentOk = words.length >= 2 && phones.length >= 10 && speechDur / totalSpan >= 0.2;
  const qualityReason = alignmentOk
    ? undefined
    : "Alignment sparse/low speech ratio; micro-fluency metrics may be unreliable.";

  return {
    silentPauses: {
      count: gapMs.length,
      totalMs: Math.round(totalSilent),
      avgMs: gapMs.length ? Math.round(totalSilent / gapMs.length) : 0
    },
    filledPauses: {
      count: filledTokens.length,
      tokens: filledTokens.slice(0, 12)
    },
    preWordPauses: {
      count: preWordPausesMs.length,
      avgMs: preWordAvg,
      examples: preWordExamples
    },
    intraWordPauses: {
      count: intraWordHits.length,
      words: intraWordHits.slice(0, 10)
    },
    phraseBreaks: {
      count: phraseBreakMs.length,
      avgMs: phraseBreakMs.length ? Math.round(phraseBreakTotal / phraseBreakMs.length) : 0
    },
    burstCount,
    longestPauseMs,
    notes,
    quality: { alignmentOk, reason: qualityReason }
  };
}

/**
 * Aggregate micro-fluency across multiple utterances
 */
export function aggregateMicroFluency(
  analyses: MicroFluencyAnalysis[]
): {
  avgSilentPauseCount: number;
  avgSilentPauseMs: number;
  totalFilledPauses: number;
  avgPreWordPauseMs: number;
  totalIntraWordPauses: number;
  avgBurstCount: number;
  avgLongestPauseMs: number;
  sampleCount: number;
  validSampleCount: number;
} {
  const valid = analyses.filter(a => a.quality.alignmentOk);
  
  if (valid.length === 0) {
    return {
      avgSilentPauseCount: 0,
      avgSilentPauseMs: 0,
      totalFilledPauses: 0,
      avgPreWordPauseMs: 0,
      totalIntraWordPauses: 0,
      avgBurstCount: 0,
      avgLongestPauseMs: 0,
      sampleCount: analyses.length,
      validSampleCount: 0
    };
  }

  return {
    avgSilentPauseCount: Math.round(valid.reduce((s, a) => s + a.silentPauses.count, 0) / valid.length * 10) / 10,
    avgSilentPauseMs: Math.round(valid.reduce((s, a) => s + a.silentPauses.avgMs, 0) / valid.length),
    totalFilledPauses: valid.reduce((s, a) => s + a.filledPauses.count, 0),
    avgPreWordPauseMs: Math.round(valid.reduce((s, a) => s + a.preWordPauses.avgMs, 0) / valid.length),
    totalIntraWordPauses: valid.reduce((s, a) => s + a.intraWordPauses.count, 0),
    avgBurstCount: Math.round(valid.reduce((s, a) => s + a.burstCount, 0) / valid.length * 10) / 10,
    avgLongestPauseMs: Math.round(valid.reduce((s, a) => s + a.longestPauseMs, 0) / valid.length),
    sampleCount: analyses.length,
    validSampleCount: valid.length
  };
}
