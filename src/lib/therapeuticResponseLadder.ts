/**
 * Therapeutic Response Ladder (TRL)
 * 
 * A 5-level state machine that determines HOW Maya should respond
 * based on real-time speech signals. Moves from passive expansion
 * (Level 0) to recovery/rebuild (Level 4).
 * 
 * This is the "guidance engine" — it turns anchoring + listening
 * into directed therapeutic progression.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ResponseLevel = 0 | 1 | 2 | 3 | 4;

export type AnchorUsageType =
  | 'passive_reference'    // Just mentions the anchor
  | 'guided_prompt'        // Uses anchor to ask a directing question
  | 'scaffolded_choice'    // Gives A-or-B options using the anchor
  | 'targeted_cue'         // Uses anchor as part of a word-finding cue
  | 'recovery_rebuild';    // Uses anchor to stabilize after breakdown

export interface ResponseLevelResult {
  level: ResponseLevel;
  label: string;
  anchorUsageType: AnchorUsageType;
  promptBlock: string;
  reasoning: string;
}

export interface TRLInputs {
  fluencyScore: number;           // 0-100
  effortfulSpeech: boolean;
  circumlocutionDetected: boolean;
  completionConfidence: 'low' | 'medium' | 'high';
  wordCount: number;
  // Session context
  consecutiveStruggles?: number;  // How many hard turns in a row
  consecutiveSuccesses?: number;  // How many good turns in a row
  frustrationLevel?: 'none' | 'low' | 'medium' | 'high';
  fatigueLevel?: 'none' | 'low' | 'medium' | 'high';
  turnNumber?: number;
}

// ═══════════════════════════════════════════════════════════════
// Level Definitions
// ═══════════════════════════════════════════════════════════════

const LEVEL_DEFS: Record<ResponseLevel, { label: string; anchorUsage: AnchorUsageType }> = {
  0: { label: 'Passive Expansion', anchorUsage: 'passive_reference' },
  1: { label: 'Guided Expansion', anchorUsage: 'guided_prompt' },
  2: { label: 'Scaffolded Choice', anchorUsage: 'scaffolded_choice' },
  3: { label: 'Targeted Cue', anchorUsage: 'targeted_cue' },
  4: { label: 'Recovery & Rebuild', anchorUsage: 'recovery_rebuild' },
};

// ═══════════════════════════════════════════════════════════════
// Decision Engine
// ═══════════════════════════════════════════════════════════════

export function determineResponseLevel(inputs: TRLInputs): ResponseLevelResult {
  const {
    fluencyScore,
    effortfulSpeech,
    circumlocutionDetected,
    completionConfidence,
    wordCount,
    consecutiveStruggles = 0,
    consecutiveSuccesses = 0,
    frustrationLevel = 'none',
    fatigueLevel = 'none',
  } = inputs;

  let level: ResponseLevel;
  let reasoning: string;

  // ── Level 4: Recovery & Rebuild ──
  // Triggered by: breakdown, frustration, or sustained struggle
  if (
    (effortfulSpeech && fluencyScore < 30) ||
    frustrationLevel === 'high' ||
    consecutiveStruggles >= 3
  ) {
    level = 4;
    reasoning = frustrationLevel === 'high'
      ? 'User frustrated — stabilize and rebuild confidence'
      : consecutiveStruggles >= 3
        ? `${consecutiveStruggles} consecutive struggles — recovery mode`
        : 'Effortful speech + very low fluency — rebuild';
  }
  // ── Level 3: Targeted Cue ──
  // Triggered by: circumlocution or stuck with moderate effort
  else if (
    circumlocutionDetected ||
    (effortfulSpeech && wordCount <= 3) ||
    completionConfidence === 'low'
  ) {
    level = 3;
    reasoning = circumlocutionDetected
      ? 'Circumlocution detected — offer target word'
      : completionConfidence === 'low'
        ? 'Low ASR confidence — confirm and scaffold'
        : 'Effortful + minimal output — provide targeted support';
  }
  // ── Level 2: Scaffolded Choice ──
  // Triggered by: hesitation, moderate fluency, or mild fatigue
  else if (
    fluencyScore < 60 ||
    (fatigueLevel === 'medium' || fatigueLevel === 'high') ||
    (wordCount <= 5 && completionConfidence === 'medium')
  ) {
    level = 2;
    reasoning = fluencyScore < 60
      ? 'Moderate fluency — offer structured choices'
      : fatigueLevel !== 'none'
        ? 'Fatigue detected — reduce cognitive load with choices'
        : 'Short response with medium confidence — scaffold';
  }
  // ── Level 1: Guided Expansion ──
  // Triggered by: okay but shallow output
  else if (
    fluencyScore < 80 ||
    (wordCount < 8 && consecutiveSuccesses < 3)
  ) {
    level = 1;
    reasoning = 'Adequate fluency but room to stretch — guide expansion';
  }
  // ── Level 0: Passive Expansion ──
  // Triggered by: fluent, confident, flowing
  else {
    level = 0;
    reasoning = 'User flowing well — light expansion, no scaffolding needed';
  }

  // ── Adjustments ──

  // Success streak → push UP (challenge more)
  if (consecutiveSuccesses >= 4 && level > 0) {
    level = Math.max(0, level - 1) as ResponseLevel;
    reasoning += ' | Streak bonus: pushed up one level';
  }

  // Frustration → push DOWN (simplify more)
  if (frustrationLevel === 'medium' && level < 3) {
    level = Math.min(4, level + 1) as ResponseLevel;
    reasoning += ' | Frustration adjustment: softened one level';
  }

  const def = LEVEL_DEFS[level];

  return {
    level,
    label: def.label,
    anchorUsageType: def.anchorUsage,
    promptBlock: buildPromptBlock(level),
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════
// Prompt Blocks — injected into the edge function system prompt
// ═══════════════════════════════════════════════════════════════

function buildPromptBlock(level: ResponseLevel): string {
  switch (level) {
    case 0:
      return `[THERAPY MODE: Level 0 — Passive Expansion]
You are in OPEN CONVERSATION mode. The user is flowing well.
Rules:
- React naturally to what they said
- Ask ONE open question that gently extends the topic
- Do NOT scaffold or simplify — they don't need it
- Use the anchor word casually, not as a prompt
Example: "Ducks at the park — what were they doing?"`;

    case 1:
      return `[THERAPY MODE: Level 1 — Guided Expansion]
The user is doing okay but could stretch more.
Rules:
- Use the anchor word to ASK a specific, directing question
- Guide them toward more detail or a new angle
- Keep it natural but purposeful — you're steering, not testing
- Avoid yes/no questions — aim for "what kind" or "how did"
Example: "At the park with your daughter — were you walking together or she ran ahead?"`;

    case 2:
      return `[THERAPY MODE: Level 2 — Scaffolded Choice]
The user is hesitating or producing limited speech.
Rules:
- Give exactly TWO simple options using the anchor word
- Make both options easy to say (short words)
- Format: "Was it [A] or [B]?"
- Do NOT ask open questions — reduce cognitive load
Example: "Your daughter at the park — were you feeding ducks or just watching?"`;

    case 3:
      return `[THERAPY MODE: Level 3 — Targeted Cue]
The user is stuck or circumlocuting.
Rules:
- If they're describing a word they can't find, OFFER the word naturally
- Use the anchor context to help them land the target
- Don't ask "what's it called?" — supply the word and confirm
- If offering a cue, say it gently: "The grocery store? Is that the place?"
Example: "The big gray one with the trunk — elephant? Is that the one?"`;

    case 4:
      return `[THERAPY MODE: Level 4 — Recovery & Rebuild]
The user is frustrated or breaking down. PRIORITY: emotional safety.
Rules:
- Acknowledge their effort warmly — "That's okay" or "No rush"
- Echo back the ONE word they DID produce, using the anchor
- Ask the SIMPLEST possible question: yes/no or "big or small?"
- Keep response VERY short (under 12 words)
- Do NOT challenge, stretch, or probe right now
Example: "That's okay — you said dog. Big dog or little dog?"`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Session-level TRL tracker
// ═══════════════════════════════════════════════════════════════

export interface TRLSessionMetrics {
  totalTurns: number;
  levelDistribution: Record<ResponseLevel, number>;
  guidedRate: number;          // % of turns at Level 1-3 (therapeutic intervention)
  avgLevel: number;
  levelProgression: ResponseLevel[];  // Track movement over session
  anchorUsageBreakdown: Record<AnchorUsageType, number>;
}

export class TRLTracker {
  private turns: { level: ResponseLevel; anchorUsage: AnchorUsageType }[] = [];
  private _consecutiveStruggles = 0;
  private _consecutiveSuccesses = 0;

  get consecutiveStruggles() { return this._consecutiveStruggles; }
  get consecutiveSuccesses() { return this._consecutiveSuccesses; }

  recordTurn(level: ResponseLevel, anchorUsage: AnchorUsageType, wasStruggle: boolean) {
    this.turns.push({ level, anchorUsage });

    if (wasStruggle) {
      this._consecutiveStruggles++;
      this._consecutiveSuccesses = 0;
    } else {
      this._consecutiveSuccesses++;
      this._consecutiveStruggles = 0;
    }
  }

  getMetrics(): TRLSessionMetrics {
    const dist: Record<ResponseLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const anchorDist: Record<AnchorUsageType, number> = {
      passive_reference: 0, guided_prompt: 0, scaffolded_choice: 0,
      targeted_cue: 0, recovery_rebuild: 0,
    };

    for (const t of this.turns) {
      dist[t.level]++;
      anchorDist[t.anchorUsage]++;
    }

    const total = this.turns.length || 1;
    const guided = dist[1] + dist[2] + dist[3]; // Levels 1-3 are "therapeutic"

    return {
      totalTurns: this.turns.length,
      levelDistribution: dist,
      guidedRate: Math.round((guided / total) * 100),
      avgLevel: Math.round((this.turns.reduce((s, t) => s + t.level, 0) / total) * 10) / 10,
      levelProgression: this.turns.map(t => t.level),
      anchorUsageBreakdown: anchorDist,
    };
  }

  reset() {
    this.turns = [];
    this._consecutiveStruggles = 0;
    this._consecutiveSuccesses = 0;
  }
}
