/**
 * Smart Coach — Live Observer
 * 
 * Sparse, event-triggered mid-exercise coaching lines via Maya.
 * Only fires when there's a clear clinical reason.
 * 
 * Rules:
 * - Max 3 observer lines per game
 * - Min 15s between lines
 * - Never interrupt active speech input
 * - Always brief (< 12 words)
 */

// ─── Types ──────────────────────────────────────────────────

export type ObserverTrigger =
  | 'speed_improvement'    // response was notably faster
  | 'streak'               // 3+ correct in a row
  | 'hesitation'           // long pause detected
  | 'repeated_error_type'  // same error pattern recurring
  | 'self_correction'      // user corrected themselves
  | 'cue_independence'     // succeeded without cue after needing one
  | 'first_success'        // first correct answer in session
  | 'confidence_drop';     // accuracy dropping mid-game

export interface ObserverEvent {
  trigger: ObserverTrigger;
  /** Target word or context */
  context?: string;
  /** How much faster (ratio) for speed triggers */
  speedRatio?: number;
  /** Current streak count */
  streakCount?: number;
  /** Current accuracy in this game */
  currentAccuracy?: number;
}

export interface ObserverLine {
  text: string;
  trigger: ObserverTrigger;
}

// ─── Observer State ─────────────────────────────────────────

export class LiveObserver {
  private lineCount = 0;
  private lastLineTime = 0;
  private consecutiveCorrect = 0;
  private consecutiveWrong = 0;
  private totalAttempts = 0;
  private correctCount = 0;
  private lastLatencyMs = 0;
  private avgLatencyMs = 0;
  private latencySum = 0;
  private hadCueLastTime = false;
  private firstCorrectFired = false;

  private readonly MAX_LINES = 3;
  private readonly MIN_GAP_MS = 15000;

  /** Reset for a new game */
  reset(): void {
    this.lineCount = 0;
    this.lastLineTime = 0;
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;
    this.totalAttempts = 0;
    this.correctCount = 0;
    this.lastLatencyMs = 0;
    this.avgLatencyMs = 0;
    this.latencySum = 0;
    this.hadCueLastTime = false;
    this.firstCorrectFired = false;
  }

  /**
   * Record a trial result and possibly return an observer line.
   * Returns null if no line should fire.
   */
  recordTrial(opts: {
    correct: boolean;
    latencyMs: number;
    targetWord?: string;
    usedCue: boolean;
    errorType?: string;
  }): ObserverLine | null {
    this.totalAttempts++;
    this.lastLatencyMs = opts.latencyMs;
    this.latencySum += opts.latencyMs;
    this.avgLatencyMs = this.latencySum / this.totalAttempts;

    if (opts.correct) {
      this.correctCount++;
      this.consecutiveCorrect++;
      this.consecutiveWrong = 0;
    } else {
      this.consecutiveCorrect = 0;
      this.consecutiveWrong++;
    }

    // Check if we can fire
    if (!this.canFire()) {
      this.hadCueLastTime = opts.usedCue;
      return null;
    }

    // ── Detect triggers (priority order) ──

    // Cue independence: succeeded without cue after needing one last time
    if (opts.correct && !opts.usedCue && this.hadCueLastTime) {
      this.hadCueLastTime = false;
      return this.fire({
        trigger: 'cue_independence',
        context: opts.targetWord,
      });
    }

    // Speed improvement: this trial was notably faster than average
    if (opts.correct && this.totalAttempts >= 3 && opts.latencyMs < this.avgLatencyMs * 0.6) {
      return this.fire({
        trigger: 'speed_improvement',
        context: opts.targetWord,
        speedRatio: this.avgLatencyMs / opts.latencyMs,
      });
    }

    // Streak: 3+ correct
    if (this.consecutiveCorrect === 3) {
      return this.fire({
        trigger: 'streak',
        streakCount: 3,
      });
    }

    // First success (early confidence builder)
    if (opts.correct && !this.firstCorrectFired && this.totalAttempts <= 2) {
      this.firstCorrectFired = true;
      return this.fire({
        trigger: 'first_success',
        context: opts.targetWord,
      });
    }

    // Confidence drop: accuracy below 40% after 4+ attempts
    if (this.totalAttempts >= 4 && this.correctCount / this.totalAttempts < 0.4 && this.consecutiveWrong >= 2) {
      return this.fire({
        trigger: 'confidence_drop',
        currentAccuracy: this.correctCount / this.totalAttempts,
      });
    }

    this.hadCueLastTime = opts.usedCue;
    return null;
  }

  private canFire(): boolean {
    if (this.lineCount >= this.MAX_LINES) return false;
    if (Date.now() - this.lastLineTime < this.MIN_GAP_MS) return false;
    return true;
  }

  private fire(event: ObserverEvent): ObserverLine {
    this.lineCount++;
    this.lastLineTime = Date.now();
    return {
      text: generateObserverText(event),
      trigger: event.trigger,
    };
  }
}

// ─── Text Generation ────────────────────────────────────────

function generateObserverText(event: ObserverEvent): string {
  switch (event.trigger) {
    case 'speed_improvement':
      if (event.context) return `"${event.context}" — faster that time.`;
      return 'That one came quicker.';

    case 'streak':
      return `${event.streakCount} in a row — good rhythm.`;

    case 'cue_independence':
      if (event.context) return `Got "${event.context}" on your own this time.`;
      return 'No help needed on that one.';

    case 'first_success':
      if (event.context) return `"${event.context}" — solid start.`;
      return 'Good start.';

    case 'confidence_drop':
      return 'Tough stretch. Take a breath — no rush.';

    case 'hesitation':
      return 'Try describing it first.';

    case 'repeated_error_type':
      return 'Same spot — try a different angle.';

    case 'self_correction':
      return 'Good catch — self-correction is a strong sign.';

    default:
      return '';
  }
}
