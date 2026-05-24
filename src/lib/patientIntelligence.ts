/**
 * Patient Intelligence — Cross-session pattern aggregation
 * 
 * Loads session intelligence snapshots from coach_conversation_summaries.metadata,
 * aggregates them into a persistent "patient profile" that Maya can use
 * to reference past sessions ("Last time /k/ and /g/ were tricky for you").
 * 
 * This is the "long-term memory" layer — persists across sessions.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SessionIntelligenceSnapshot, SessionPattern, PhonemeError } from './sessionIntelligence';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface PatientIntelligenceProfile {
  /** Phoneme pairs the user confuses across sessions (sorted by frequency) */
  persistentPhonemeErrors: { phonemes: string; totalCount: number; sessionCount: number }[];
  /** Words that are consistently hard (appeared in 2+ sessions) */
  persistentStruggledWords: { word: string; sessionCount: number }[];
  /** Words that used to be hard but are now mastered */
  recoveredWords: string[];
  /** Dominant patterns across sessions */
  dominantPatterns: { type: string; detail: string; sessionCount: number }[];
  /** Average success rate trend across sessions */
  successRateTrend: 'improving' | 'stable' | 'declining';
  /** Average latency trend */
  latencyTrend: 'faster' | 'stable' | 'slower';
  /** How many sessions of data we have */
  sessionCount: number;
  /** Best cue type based on history */
  preferredCueType: 'semantic' | 'phonemic' | 'unknown';
  /** Whether user tends toward circumlocution */
  circumlocutionTendency: 'high' | 'moderate' | 'low';
}

export interface SessionIntelligenceMetadata {
  /** Serialized snapshot from SessionIntelligenceTracker.getSnapshot() */
  struggledWords: string[];
  masteredWords: string[];
  phonemeErrors: { targetPhoneme: string; spokenPhoneme: string; word: string; count: number }[];
  patterns: { type: string; detail: string; confidence: number; occurrences: number }[];
  avgLatencyMs: number;
  latencyTrend: 'faster' | 'stable' | 'slower';
  cueDependencyTrend: 'decreasing' | 'stable' | 'increasing';
  totalAttempts: number;
  successRate: number;
  circumlocutionCount: number;
}

// ═══════════════════════════════════════════════════════════════
// Serialize snapshot for persistence
// ═══════════════════════════════════════════════════════════════

export function serializeSnapshotForStorage(snapshot: SessionIntelligenceSnapshot): SessionIntelligenceMetadata {
  return {
    struggledWords: snapshot.struggledWords,
    masteredWords: snapshot.masteredWords,
    phonemeErrors: snapshot.phonemeErrors.map(e => ({
      targetPhoneme: e.targetPhoneme,
      spokenPhoneme: e.spokenPhoneme,
      word: e.word,
      count: e.count,
    })),
    patterns: snapshot.patterns.map(p => ({
      type: p.type,
      detail: p.detail,
      confidence: p.confidence,
      occurrences: p.occurrences,
    })),
    avgLatencyMs: snapshot.avgLatencyMs,
    latencyTrend: snapshot.latencyTrend,
    cueDependencyTrend: snapshot.cueDependencyTrend,
    totalAttempts: snapshot.totalAttempts,
    successRate: snapshot.successRate,
    circumlocutionCount: snapshot.circumlocutionCount,
  };
}

// ═══════════════════════════════════════════════════════════════
// Load and aggregate cross-session intelligence
// ═══════════════════════════════════════════════════════════════

export async function loadPatientIntelligence(
  userId: string,
  limit = 10,
  profileId?: string | null
): Promise<PatientIntelligenceProfile | null> {
  let query = (supabase as any)
    .from('coach_conversation_summaries')
    .select('metadata, avg_score, created_at, profile_id')
    .eq('user_id', userId)
    .not('metadata', 'is', null);

  // Scope to a specific patient profile when provided.
  // Critical: accounts with multiple profiles (e.g. demo/clinician test accounts)
  // would otherwise bleed one patient's Maya summaries into another's review.
  if (profileId) {
    query = query.eq('profile_id', profileId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return null;

  const sessions: SessionIntelligenceMetadata[] = data
    .map((row: any) => row.metadata as SessionIntelligenceMetadata | null)
    .filter((m: any): m is SessionIntelligenceMetadata => m !== null && m.totalAttempts > 0);

  if (sessions.length === 0) return null;

  return aggregateSessions(sessions, data);
}

function aggregateSessions(
  sessions: SessionIntelligenceMetadata[],
  rawRows: any[]
): PatientIntelligenceProfile {
  // ── Phoneme errors ──
  const phonemeCounts = new Map<string, { total: number; sessions: Set<number> }>();
  sessions.forEach((s, i) => {
    for (const pe of s.phonemeErrors || []) {
      const key = `/${pe.targetPhoneme}/ vs /${pe.spokenPhoneme}/`;
      const existing = phonemeCounts.get(key) || { total: 0, sessions: new Set() };
      existing.total += pe.count;
      existing.sessions.add(i);
      phonemeCounts.set(key, existing);
    }
  });
  const persistentPhonemeErrors = [...phonemeCounts.entries()]
    .filter(([, v]) => v.sessions.size >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([phonemes, v]) => ({ phonemes, totalCount: v.total, sessionCount: v.sessions.size }));

  // ── Struggled words ──
  const wordStruggleCounts = new Map<string, Set<number>>();
  sessions.forEach((s, i) => {
    for (const w of s.struggledWords || []) {
      const existing = wordStruggleCounts.get(w) || new Set();
      existing.add(i);
      wordStruggleCounts.set(w, existing);
    }
  });
  const persistentStruggledWords = [...wordStruggleCounts.entries()]
    .filter(([, s]) => s.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([word, s]) => ({ word, sessionCount: s.size }));

  // ── Recovered words (struggled before, mastered recently) ──
  const recentMastered = new Set(sessions[0]?.masteredWords || []);
  const previousStruggles = new Set<string>();
  sessions.slice(1).forEach(s => (s.struggledWords || []).forEach(w => previousStruggles.add(w)));
  const recoveredWords = [...recentMastered].filter(w => previousStruggles.has(w));

  // ── Dominant patterns ──
  const patternCounts = new Map<string, { detail: string; sessions: Set<number> }>();
  sessions.forEach((s, i) => {
    for (const p of s.patterns || []) {
      const existing = patternCounts.get(p.type) || { detail: p.detail, sessions: new Set() };
      existing.sessions.add(i);
      patternCounts.set(p.type, existing);
    }
  });
  const dominantPatterns = [...patternCounts.entries()]
    .filter(([, v]) => v.sessions.size >= 2)
    .sort((a, b) => b[1].sessions.size - a[1].sessions.size)
    .map(([type, v]) => ({ type, detail: v.detail, sessionCount: v.sessions.size }));

  // ── Success rate trend ──
  const successRates = sessions.map(s => s.successRate).filter(r => r > 0);
  let successRateTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (successRates.length >= 3) {
    const recent = successRates.slice(0, Math.ceil(successRates.length / 2));
    const older = successRates.slice(Math.ceil(successRates.length / 2));
    const recentAvg = recent.reduce((s, r) => s + r, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r, 0) / older.length;
    if (recentAvg > olderAvg + 0.1) successRateTrend = 'improving';
    else if (recentAvg < olderAvg - 0.1) successRateTrend = 'declining';
  }

  // ── Latency trend ──
  const latencies = sessions.map(s => s.avgLatencyMs).filter(l => l > 0);
  let latencyTrend: 'faster' | 'stable' | 'slower' = 'stable';
  if (latencies.length >= 3) {
    const recent = latencies.slice(0, Math.ceil(latencies.length / 2));
    const older = latencies.slice(Math.ceil(latencies.length / 2));
    const recentAvg = recent.reduce((s, l) => s + l, 0) / recent.length;
    const olderAvg = older.reduce((s, l) => s + l, 0) / older.length;
    if (recentAvg < olderAvg * 0.85) latencyTrend = 'faster';
    else if (recentAvg > olderAvg * 1.15) latencyTrend = 'slower';
  }

  // ── Preferred cue type (semantic vs phonemic — based on which cue dependency decreases more) ──
  const cueTrends = sessions.map(s => s.cueDependencyTrend);
  const preferredCueType: 'semantic' | 'phonemic' | 'unknown' = 'unknown'; // TODO: infer from actual cue effectiveness data

  // ── Circumlocution tendency ──
  const circumCounts = sessions.map(s => s.circumlocutionCount || 0);
  const avgCircum = circumCounts.reduce((s, c) => s + c, 0) / Math.max(circumCounts.length, 1);
  const circumlocutionTendency: 'high' | 'moderate' | 'low' =
    avgCircum >= 3 ? 'high' : avgCircum >= 1 ? 'moderate' : 'low';

  return {
    persistentPhonemeErrors,
    persistentStruggledWords,
    recoveredWords,
    dominantPatterns,
    successRateTrend,
    latencyTrend,
    sessionCount: sessions.length,
    preferredCueType,
    circumlocutionTendency,
  };
}

// ═══════════════════════════════════════════════════════════════
// Format for AI prompt injection
// ═══════════════════════════════════════════════════════════════

export function formatPatientIntelligenceForPrompt(profile: PatientIntelligenceProfile): string {
  if (profile.sessionCount === 0) return '';

  const parts: string[] = ['CROSS-SESSION INTELLIGENCE (reference naturally, never quote):'];

  if (profile.persistentPhonemeErrors.length > 0) {
    const phonemes = profile.persistentPhonemeErrors.slice(0, 3).map(e => e.phonemes).join(', ');
    parts.push(`Persistent sound confusion: ${phonemes} — consider minimal pair practice`);
  }

  if (profile.persistentStruggledWords.length > 0) {
    const words = profile.persistentStruggledWords.slice(0, 5).map(w => w.word).join(', ');
    parts.push(`Consistently hard words: ${words}`);
  }

  if (profile.recoveredWords.length > 0) {
    parts.push(`Words they've improved on: ${profile.recoveredWords.slice(0, 3).join(', ')} — acknowledge this!`);
  }

  if (profile.dominantPatterns.length > 0) {
    for (const p of profile.dominantPatterns.slice(0, 2)) {
      if (p.type === 'circumlocution_habit') {
        parts.push(`Tends to describe around words — gently help find the target word`);
      } else if (p.type === 'slow_retrieval') {
        parts.push(`Takes time to find words — be patient, give extra time`);
      } else if (p.type === 'improving') {
        parts.push(`Getting better over time — acknowledge the progress`);
      }
    }
  }

  if (profile.successRateTrend !== 'stable') {
    parts.push(`Overall trend: ${profile.successRateTrend === 'improving' ? 'getting stronger over time' : 'having a harder time recently — be supportive'}`);
  }

  if (profile.circumlocutionTendency === 'high') {
    parts.push(`High circumlocution tendency — this person often describes instead of names. Help them find the word.`);
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// Format for orchestrator (exercise selection biasing)
// ═══════════════════════════════════════════════════════════════

export interface IntelligenceBiases {
  /** Increase minimal pair frequency if phoneme confusion detected */
  minimalPairBias: number; // 0-1
  /** Increase photo naming frequency if circumlocution tendency */
  photoNamingBias: number; // 0-1
  /** Target phonemes for minimal pair selection */
  targetPhonemes: string[];
  /** Target words to re-attempt */
  retryWords: string[];
}

export function getIntelligenceBiases(profile: PatientIntelligenceProfile | null): IntelligenceBiases {
  if (!profile) {
    return { minimalPairBias: 0, photoNamingBias: 0, targetPhonemes: [], retryWords: [] };
  }

  return {
    minimalPairBias: Math.min(profile.persistentPhonemeErrors.length * 0.2, 0.6),
    photoNamingBias: profile.circumlocutionTendency === 'high' ? 0.4 : profile.circumlocutionTendency === 'moderate' ? 0.2 : 0,
    targetPhonemes: profile.persistentPhonemeErrors.slice(0, 3).flatMap(e => {
      const match = e.phonemes.match(/\/(.+?)\//g);
      return match ? match.map(m => m.replace(/\//g, '')) : [];
    }),
    retryWords: profile.persistentStruggledWords.slice(0, 5).map(w => w.word),
  };
}
