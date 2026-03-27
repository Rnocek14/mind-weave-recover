/**
 * Session Intelligence — Within-session memory and pattern detection
 * 
 * Tracks everything that happens during a single conversation session
 * so Maya can reference earlier events ("You almost had that earlier",
 * "Let's try this one again — you were close before").
 * 
 * This is the "short-term memory" layer — resets each session.
 */

import type { MatchResult, MatchType } from './answerMatcher';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface WordAttempt {
  word: string;
  matchType: MatchType;
  confidence: number;
  wasCorrect: boolean;
  cueLevel: number;
  latencyMs: number;
  turnNumber: number;
  timestamp: number;
}

export interface PhonemeError {
  targetPhoneme: string;
  spokenPhoneme: string;
  word: string;
  count: number;
  turnNumbers: number[];
}

export interface SessionPattern {
  type: 'phoneme_confusion' | 'semantic_substitution' | 'slow_retrieval' | 'improving' | 'circumlocution_habit';
  detail: string;
  confidence: number;
  occurrences: number;
}

export interface SessionIntelligenceSnapshot {
  /** Words the user struggled with (failed or needed cues) */
  struggledWords: string[];
  /** Words the user got right easily */
  masteredWords: string[];
  /** Words attempted more than once */
  repeatedWords: Map<string, WordAttempt[]>;
  /** Detected phoneme confusions */
  phonemeErrors: PhonemeError[];
  /** Detected session-level patterns */
  patterns: SessionPattern[];
  /** Average response latency (ms) */
  avgLatencyMs: number;
  /** Whether user is getting faster over the session */
  latencyTrend: 'faster' | 'stable' | 'slower';
  /** Current cue dependency level (0-4) — are they needing more or fewer cues? */
  cueDependencyTrend: 'decreasing' | 'stable' | 'increasing';
  /** Total attempts this session */
  totalAttempts: number;
  /** Success rate this session */
  successRate: number;
  /** Circumlocution count */
  circumlocutionCount: number;
}

// ═══════════════════════════════════════════════════════════════
// Session Intelligence Tracker
// ═══════════════════════════════════════════════════════════════

export class SessionIntelligenceTracker {
  private attempts: WordAttempt[] = [];
  private phonemeErrorMap: Map<string, PhonemeError> = new Map();
  private circumlocutions: number = 0;

  /** Record an inline photo naming attempt */
  recordPhotoAttempt(
    target: string,
    matchResult: MatchResult,
    cueLevel: number,
    latencyMs: number,
    turnNumber: number,
  ): void {
    this.attempts.push({
      word: target.toLowerCase(),
      matchType: matchResult.matchType,
      confidence: matchResult.confidence,
      wasCorrect: matchResult.countsAsCorrect,
      cueLevel,
      latencyMs,
      turnNumber,
      timestamp: Date.now(),
    });

    if (matchResult.matchType === 'circumlocution') {
      this.circumlocutions++;
    }
  }

  /** Record a minimal pair attempt */
  recordMinimalPairAttempt(
    targetWord: string,
    otherWord: string,
    wasCorrect: boolean,
    latencyMs: number,
    turnNumber: number,
    phoneme1: string,
    phoneme2: string,
  ): void {
    this.attempts.push({
      word: targetWord.toLowerCase(),
      matchType: wasCorrect ? 'exact' : 'no_match',
      confidence: wasCorrect ? 1 : 0.3,
      wasCorrect,
      cueLevel: 0,
      latencyMs,
      turnNumber,
      timestamp: Date.now(),
    });

    // Track phoneme confusion
    if (!wasCorrect) {
      const key = `${phoneme1}/${phoneme2}`;
      const existing = this.phonemeErrorMap.get(key);
      if (existing) {
        existing.count++;
        existing.turnNumbers.push(turnNumber);
      } else {
        this.phonemeErrorMap.set(key, {
          targetPhoneme: phoneme1,
          spokenPhoneme: phoneme2,
          word: targetWord,
          count: 1,
          turnNumbers: [turnNumber],
        });
      }
    }
  }

  /** Record a conversational struggle signal (circumlocution, effortful speech) */
  recordConversationSignal(
    type: 'circumlocution' | 'effortful' | 'filled_pauses',
    turnNumber: number,
    context?: string,
  ): void {
    if (type === 'circumlocution') {
      this.circumlocutions++;
    }
  }

  /** Check if a word was hard before in this session */
  wasHardBefore(word: string): boolean {
    const lower = word.toLowerCase();
    return this.attempts.some(a => a.word === lower && (!a.wasCorrect || a.cueLevel > 0));
  }

  /** Check if user is improving on a specific word */
  isImprovingOn(word: string): boolean {
    const lower = word.toLowerCase();
    const wordAttempts = this.attempts.filter(a => a.word === lower);
    if (wordAttempts.length < 2) return false;
    const last = wordAttempts[wordAttempts.length - 1];
    const prev = wordAttempts[wordAttempts.length - 2];
    return last.wasCorrect && !prev.wasCorrect;
  }

  /** Get the cue level needed last time for a word */
  lastCueLevelFor(word: string): number | null {
    const lower = word.toLowerCase();
    const wordAttempts = this.attempts.filter(a => a.word === lower);
    return wordAttempts.length > 0 ? wordAttempts[wordAttempts.length - 1].cueLevel : null;
  }

  /** Get full snapshot for AI context injection */
  getSnapshot(): SessionIntelligenceSnapshot {
    const correct = this.attempts.filter(a => a.wasCorrect);
    const struggled = this.attempts.filter(a => !a.wasCorrect || a.cueLevel > 0);

    // Words attempted multiple times
    const wordCounts = new Map<string, WordAttempt[]>();
    for (const a of this.attempts) {
      const existing = wordCounts.get(a.word) || [];
      existing.push(a);
      wordCounts.set(a.word, existing);
    }
    const repeatedWords = new Map<string, WordAttempt[]>();
    for (const [word, attempts] of wordCounts) {
      if (attempts.length > 1) repeatedWords.set(word, attempts);
    }

    // Latency trend (compare first half vs second half)
    const latencies = this.attempts.map(a => a.latencyMs).filter(l => l > 0);
    const avgLatency = latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length : 0;
    let latencyTrend: 'faster' | 'stable' | 'slower' = 'stable';
    if (latencies.length >= 4) {
      const mid = Math.floor(latencies.length / 2);
      const firstHalf = latencies.slice(0, mid).reduce((s, l) => s + l, 0) / mid;
      const secondHalf = latencies.slice(mid).reduce((s, l) => s + l, 0) / (latencies.length - mid);
      if (secondHalf < firstHalf * 0.8) latencyTrend = 'faster';
      else if (secondHalf > firstHalf * 1.2) latencyTrend = 'slower';
    }

    // Cue dependency trend
    const cueLevels = this.attempts.map(a => a.cueLevel);
    let cueTrend: 'decreasing' | 'stable' | 'increasing' = 'stable';
    if (cueLevels.length >= 4) {
      const mid = Math.floor(cueLevels.length / 2);
      const firstAvg = cueLevels.slice(0, mid).reduce((s, c) => s + c, 0) / mid;
      const secondAvg = cueLevels.slice(mid).reduce((s, c) => s + c, 0) / (cueLevels.length - mid);
      if (secondAvg < firstAvg - 0.3) cueTrend = 'decreasing';
      else if (secondAvg > firstAvg + 0.3) cueTrend = 'increasing';
    }

    // Detect patterns
    const patterns: SessionPattern[] = [];

    // Phoneme confusion pattern
    for (const [key, error] of this.phonemeErrorMap) {
      if (error.count >= 2) {
        patterns.push({
          type: 'phoneme_confusion',
          detail: `/${error.targetPhoneme}/ vs /${error.spokenPhoneme}/`,
          confidence: Math.min(0.5 + error.count * 0.15, 0.95),
          occurrences: error.count,
        });
      }
    }

    // Circumlocution habit
    if (this.circumlocutions >= 2) {
      patterns.push({
        type: 'circumlocution_habit',
        detail: `${this.circumlocutions} circumlocutions this session`,
        confidence: Math.min(0.5 + this.circumlocutions * 0.1, 0.9),
        occurrences: this.circumlocutions,
      });
    }

    // Improving pattern
    if (latencyTrend === 'faster' && cueTrend === 'decreasing') {
      patterns.push({
        type: 'improving',
        detail: 'Getting faster and needing fewer cues',
        confidence: 0.75,
        occurrences: this.attempts.length,
      });
    }

    // Slow retrieval pattern
    const slowAttempts = this.attempts.filter(a => a.latencyMs > 8000);
    if (slowAttempts.length >= 3) {
      patterns.push({
        type: 'slow_retrieval',
        detail: `${slowAttempts.length} attempts took over 8 seconds`,
        confidence: 0.7,
        occurrences: slowAttempts.length,
      });
    }

    return {
      struggledWords: [...new Set(struggled.map(a => a.word))],
      masteredWords: [...new Set(correct.filter(a => a.cueLevel === 0 && a.latencyMs < 5000).map(a => a.word))],
      repeatedWords,
      phonemeErrors: [...this.phonemeErrorMap.values()],
      patterns,
      avgLatencyMs: Math.round(avgLatency),
      latencyTrend,
      cueDependencyTrend: cueTrend,
      totalAttempts: this.attempts.length,
      successRate: this.attempts.length > 0 ? correct.length / this.attempts.length : 0,
      circumlocutionCount: this.circumlocutions,
    };
  }

  /** Format for AI prompt injection — concise, actionable */
  formatForPrompt(): string {
    const snap = this.getSnapshot();
    if (snap.totalAttempts === 0) return '';

    const parts: string[] = ['SESSION MEMORY (use naturally, do not quote verbatim):'];

    if (snap.struggledWords.length > 0) {
      parts.push(`Struggled with: ${snap.struggledWords.slice(0, 5).join(', ')}`);
    }
    if (snap.masteredWords.length > 0) {
      parts.push(`Got easily: ${snap.masteredWords.slice(0, 5).join(', ')}`);
    }

    // Repeated words with improvement
    for (const [word, attempts] of snap.repeatedWords) {
      const lastCorrect = attempts[attempts.length - 1].wasCorrect;
      const firstCorrect = attempts[0].wasCorrect;
      if (lastCorrect && !firstCorrect) {
        parts.push(`Improved on "${word}" (struggled then got it)`);
      } else if (!lastCorrect) {
        parts.push(`Still struggling with "${word}" (${attempts.length} attempts)`);
      }
    }

    for (const pattern of snap.patterns) {
      if (pattern.type === 'phoneme_confusion') {
        parts.push(`Phoneme confusion: ${pattern.detail} (${pattern.occurrences}x)`);
      } else if (pattern.type === 'improving') {
        parts.push(`Session trend: improving — getting faster with fewer cues`);
      } else if (pattern.type === 'circumlocution_habit') {
        parts.push(`Describing around words instead of naming (${snap.circumlocutionCount}x)`);
      }
    }

    if (snap.latencyTrend !== 'stable') {
      parts.push(`Response speed: ${snap.latencyTrend}`);
    }
    if (snap.cueDependencyTrend !== 'stable') {
      parts.push(`Cue needs: ${snap.cueDependencyTrend}`);
    }

    parts.push(`Session accuracy: ${Math.round(snap.successRate * 100)}% (${snap.totalAttempts} attempts)`);

    return parts.join('\n');
  }

  /** Reset for new session */
  reset(): void {
    this.attempts = [];
    this.phonemeErrorMap.clear();
    this.circumlocutions = 0;
  }
}
