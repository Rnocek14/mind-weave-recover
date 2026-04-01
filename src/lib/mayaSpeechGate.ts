/**
 * Maya Speech Gate — Single outgoing-message validator
 * 
 * Every Maya utterance, regardless of source (edge function, flowEngine,
 * therapistFeedback, yesNoBank, game transitions), MUST pass through
 * this gate before being rendered, queued for TTS, or inserted as a message.
 * 
 * 5 checks:
 * 1. Promise check — no "let me show you" unless visual is launching
 * 2. Vague filler check — no bare "keep going" without topic anchor
 * 3. Topic persistence — no random topic switch when active topic exists
 * 4. Memory repetition — no re-asking established facts
 * 5. Correction priority — if user just corrected Maya, force re-anchor
 */

// ─── Types ───────────────────────────────────────────────────

export interface GateInput {
  text: string;
  activeTopic: string | null;
  establishedFacts: string[];
  userCorrectionActive: boolean;
  pendingVisualAction: boolean;
  source: string; // 'edge_function' | 'flow_engine' | 'therapist_feedback' | 'yes_no_bank' | 'game_transition' | 'fallback' | etc
}

export interface GateResult {
  approvedText: string;
  blocked: boolean;
  reason?: string;
  rewritten?: boolean;
}

// ─── Patterns ────────────────────────────────────────────────

const PROMISE_PATTERNS = [
  /let me show you/i,
  /i'?ll show you/i,
  /let me pull up/i,
  /check this out/i,
  /have a look at this/i,
  /let me try something/i,
  /here['—–-]\s*(have a|take a) look/i,
];

const VAGUE_FILLER_PATTERNS = [
  /^keep going\.?$/i,
  /^go on\.?$/i,
  /^continue\.?$/i,
  /^what were you (saying|telling me)\??$/i,
  /^you were saying\??$/i,
  /^go ahead\.?$/i,
  /^tell me more\.?$/i,
];

// Off-topic yes/no question patterns (from yesNoBank)
const OFF_TOPIC_PATTERNS = [
  /is it cold outside/i,
  /did you sleep well/i,
  /did you have coffee/i,
  /did you eat breakfast/i,
  /did you go outside/i,
  /did you watch tv/i,
  /is it morning right now/i,
  /are you sitting down/i,
  /is someone else in the room/i,
  /is the tv on/i,
  /do you have water nearby/i,
  /do you like (coffee|music|sunny|dogs|ice cream|flowers)/i,
  /how was your morning/i,
  /what did you do today/i,
];

// Memory repetition patterns — "what was that again", "remind me"
const RE_ASK_PATTERNS = [
  /what was that again/i,
  /remind me what/i,
  /what did you say it was/i,
  /tell me again/i,
  /what was it called/i,
  /what were we talking about/i,
];

// ─── Gate logs (in-memory ring buffer for debugging) ─────────

interface GateLog {
  timestamp: number;
  original: string;
  approved: string;
  blocked: boolean;
  reason?: string;
  rewritten?: boolean;
  source: string;
}

const _gateLogs: GateLog[] = [];
const MAX_GATE_LOGS = 50;

export function getGateLogs(): readonly GateLog[] {
  return _gateLogs;
}

function logGateDecision(entry: GateLog) {
  _gateLogs.push(entry);
  if (_gateLogs.length > MAX_GATE_LOGS) _gateLogs.shift();
  
  if (entry.blocked || entry.rewritten) {
    console.log(
      `[MayaSpeechGate] ${entry.blocked ? 'BLOCKED' : 'REWRITTEN'} | source=${entry.source} | reason=${entry.reason}\n  original: "${entry.original}"\n  approved: "${entry.approved}"`
    );
  }
}

// ─── Topic-safe fallback generator ───────────────────────────

function makeTopicFallback(topic: string): string {
  const fallbacks = [
    `Tell me more about ${topic}.`,
    `So, about ${topic} — what else?`,
    `Let's keep going with ${topic}. What happened next?`,
    `I want to hear more about ${topic}.`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function makeTopicReanchor(topic: string): string {
  const anchors = [
    `Right, sorry — you were telling me about ${topic}. Go on.`,
    `Got it — back to ${topic}. What were you saying?`,
    `Okay, ${topic}. Tell me more about that.`,
    `My bad — let's get back to ${topic}. You were saying?`,
  ];
  return anchors[Math.floor(Math.random() * anchors.length)];
}

// ─── Main gate function ──────────────────────────────────────

export function sanitizeMayaLine(input: GateInput): GateResult {
  const { text, activeTopic, establishedFacts, userCorrectionActive, pendingVisualAction, source } = input;
  
  const trimmed = text.trim();
  if (!trimmed) {
    return { approvedText: text, blocked: false };
  }

  // === Check 5: Correction priority (highest priority) ===
  if (userCorrectionActive && activeTopic) {
    // If the line doesn't mention the active topic, force re-anchor
    if (!trimmed.toLowerCase().includes(activeTopic.toLowerCase())) {
      const reanchored = makeTopicReanchor(activeTopic);
      logGateDecision({
        timestamp: Date.now(), original: trimmed, approved: reanchored,
        blocked: false, rewritten: true, reason: 'correction_priority_reanchor', source,
      });
      return { approvedText: reanchored, blocked: false, rewritten: true, reason: 'correction_priority_reanchor' };
    }
  }

  // === Check 1: Promise check ===
  if (!pendingVisualAction) {
    for (const pattern of PROMISE_PATTERNS) {
      if (pattern.test(trimmed)) {
        // Rewrite: strip promise, replace with topic-safe line
        const rewritten = activeTopic
          ? makeTopicFallback(activeTopic)
          : trimmed.replace(pattern, '').replace(/^\s*[—–-]\s*/, '').trim() || "What else comes to mind?";
        
        logGateDecision({
          timestamp: Date.now(), original: trimmed, approved: rewritten,
          blocked: false, rewritten: true, reason: 'unfulfillable_promise', source,
        });
        return { approvedText: rewritten, blocked: false, rewritten: true, reason: 'unfulfillable_promise' };
      }
    }
  }

  // === Check 2: Vague filler check ===
  for (const pattern of VAGUE_FILLER_PATTERNS) {
    if (pattern.test(trimmed)) {
      const rewritten = activeTopic
        ? makeTopicFallback(activeTopic)
        : "What else comes to mind?";
      
      logGateDecision({
        timestamp: Date.now(), original: trimmed, approved: rewritten,
        blocked: false, rewritten: true, reason: 'vague_filler', source,
      });
      return { approvedText: rewritten, blocked: false, rewritten: true, reason: 'vague_filler' };
    }
  }

  // === Check 3: Topic persistence ===
  if (activeTopic) {
    for (const pattern of OFF_TOPIC_PATTERNS) {
      if (pattern.test(trimmed)) {
        const rewritten = makeTopicFallback(activeTopic);
        logGateDecision({
          timestamp: Date.now(), original: trimmed, approved: rewritten,
          blocked: false, rewritten: true, reason: 'off_topic_when_active_topic', source,
        });
        return { approvedText: rewritten, blocked: false, rewritten: true, reason: 'off_topic_when_active_topic' };
      }
    }
  }

  // === Check 4: Memory repetition ===
  if (establishedFacts.length > 0) {
    for (const pattern of RE_ASK_PATTERNS) {
      if (pattern.test(trimmed)) {
        // Check if the line is re-asking about something already established
        const rewritten = activeTopic
          ? `So, more about ${activeTopic} — what happened next?`
          : "Okay — tell me what happened next.";
        
        logGateDecision({
          timestamp: Date.now(), original: trimmed, approved: rewritten,
          blocked: false, rewritten: true, reason: 'memory_repetition', source,
        });
        return { approvedText: rewritten, blocked: false, rewritten: true, reason: 'memory_repetition' };
      }
    }
  }

  // === Passed all checks ===
  logGateDecision({
    timestamp: Date.now(), original: trimmed, approved: trimmed,
    blocked: false, reason: undefined, source,
  });
  return { approvedText: trimmed, blocked: false };
}

export function resetGateLogs(): void {
  _gateLogs.length = 0;
}
