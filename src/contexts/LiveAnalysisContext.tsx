/**
 * Live Analysis Context
 * 
 * Lightweight context for exercises to push real-time speech analysis,
 * adaptation decisions, and engine state into a side panel.
 * 
 * Pattern: provider + hook with setLiveSnapshot / appendAuditEvent / clearLiveAnalysis
 */

import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react';

// ===== Source tags for traceability =====
export type AnalysisSource = 'asr' | 'utterance_analyzer' | 'adaptation_engine' | 'pivot_engine' | 'lesson_planner' | 'cue_selector';

// ===== Live snapshot: current-moment state =====
export interface LiveSnapshot {
  /** Identity of the recording/answer that may update these speech metrics. */
  attemptId?: string;
  // Live Input
  transcript?: string;
  targetWord?: string;
  targetPhrase?: string;
  asrConfidence?: number;
  micState?: 'idle' | 'listening' | 'processing' | 'off';
  latencyMs?: number;

  // Speech Analysis
  errorType?: string;
  phonologicalSimilarity?: number;
  semanticSimilarity?: number;
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  meaningAccuracy?: number;
  circumlocutionDetected?: boolean;
  effortfulSpeech?: boolean;
  reasoning?: string;
  classificationConfidence?: number;

  // Adaptation State
  currentDomain?: string;
  difficultyTier?: number;
  cueType?: string;
  cueLevel?: number;
  cueTrigger?: string;
  focusPhonemes?: string[];
  scheduledRepetitionWords?: string[];
  adaptationReasons?: string[];
  transferIndex?: number;
  profileConfidence?: string;

  // Session State
  trialIndex?: number;
  trialTotal?: number;
  recentAccuracies?: number[];
  consecutiveErrors?: number;
  frustrationLevel?: string;
  pivotRecommendation?: {
    action: string;
    reason: string;
    confidence: string;
  } | null;
  fatigueFlag?: boolean;

  // Encouragement
  encouragementScore?: number;
  encouragementLevel?: string;

  // Meta
  exerciseSlug?: string;
  sessionId?: string;
  updatedAt?: number; // timestamp for freshness
}

// ===== Audit event: logged adaptation action =====
export interface AuditEvent {
  id: string;
  timestamp: number;
  source: AnalysisSource;
  eventType: string;
  label: string; // human-readable
  detail?: string;
  confidence?: string;
  rawData?: any;
}

// ===== Decision chain: the "gold card" for demos =====
export interface DecisionChain {
  transcript: string;
  detected: string;
  confidence: string;
  cueChosen: string;
  difficultyAction: string;
  reason: string;
  timestamp: number;
}

// ===== Context value =====
interface LiveAnalysisContextValue {
  snapshot: LiveSnapshot;
  auditEvents: AuditEvent[];
  decisionChain: DecisionChain | null;
  isOpen: boolean;

  setLiveSnapshot: (update: Partial<LiveSnapshot>, expectedAttemptId?: string | null) => void;
  appendAuditEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  setDecisionChain: (chain: DecisionChain | null, expectedAttemptId?: string | null) => void;
  clearLiveAnalysis: () => void;
  setIsOpen: (open: boolean) => void;
}

const LiveAnalysisContext = createContext<LiveAnalysisContextValue | null>(null);

const MAX_AUDIT_EVENTS = 20;

// These values describe one utterance. Absence on a new attempt must never
// inherit an earlier patient's answer/measurement through a partial merge.
const EMPTY_SPEECH_SNAPSHOT: Partial<LiveSnapshot> = {
  transcript: undefined, targetWord: undefined, targetPhrase: undefined,
  asrConfidence: undefined, latencyMs: undefined, errorType: undefined,
  phonologicalSimilarity: undefined, semanticSimilarity: undefined,
  pronunciationScore: undefined, accuracyScore: undefined, fluencyScore: undefined,
  completenessScore: undefined, prosodyScore: undefined, meaningAccuracy: undefined,
  circumlocutionDetected: undefined, effortfulSpeech: undefined, reasoning: undefined,
  classificationConfidence: undefined, encouragementScore: undefined,
  encouragementLevel: undefined,
};

let auditCounter = 0;

export function LiveAnalysisProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshotState] = useState<LiveSnapshot>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [decisionChain, setDecisionChainState] = useState<DecisionChain | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Use ref for snapshot to avoid stale closures in rapid updates
  const snapshotRef = useRef<LiveSnapshot>({});

  const setLiveSnapshot = useCallback((update: Partial<LiveSnapshot>, expectedAttemptId?: string | null) => {
    if (expectedAttemptId !== undefined &&
      (!expectedAttemptId || snapshotRef.current.attemptId !== expectedAttemptId)) return;
    const newAttempt = update.attemptId !== undefined && update.attemptId !== snapshotRef.current.attemptId;
    const next = {
      ...snapshotRef.current,
      ...(newAttempt ? EMPTY_SPEECH_SNAPSHOT : {}),
      ...update,
      updatedAt: Date.now(),
    };
    snapshotRef.current = next;
    setSnapshotState(next);
    if (newAttempt) setDecisionChainState(null);
  }, []);

  const appendAuditEvent = useCallback((event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const fullEvent: AuditEvent = {
      ...event,
      id: `audit_${++auditCounter}`,
      timestamp: Date.now(),
    };
    setAuditEvents(prev => {
      const next = [fullEvent, ...prev];
      return next.length > MAX_AUDIT_EVENTS ? next.slice(0, MAX_AUDIT_EVENTS) : next;
    });
  }, []);

  const setDecisionChain = useCallback((chain: DecisionChain | null, expectedAttemptId?: string | null) => {
    if (expectedAttemptId !== undefined &&
      (!expectedAttemptId || snapshotRef.current.attemptId !== expectedAttemptId)) return;
    setDecisionChainState(chain);
  }, []);

  const clearLiveAnalysis = useCallback(() => {
    snapshotRef.current = {};
    setSnapshotState({});
    setAuditEvents([]);
    setDecisionChainState(null);
  }, []);

  return (
    <LiveAnalysisContext.Provider value={{
      snapshot,
      auditEvents,
      decisionChain,
      isOpen,
      setLiveSnapshot,
      appendAuditEvent,
      setDecisionChain,
      clearLiveAnalysis,
      setIsOpen,
    }}>
      {children}
    </LiveAnalysisContext.Provider>
  );
}

export function useLiveAnalysis() {
  const ctx = useContext(LiveAnalysisContext);
  if (!ctx) {
    // Return no-op stub when used outside provider (safe for non-instrumented exercises)
    return {
      snapshot: {} as LiveSnapshot,
      auditEvents: [] as AuditEvent[],
      decisionChain: null as DecisionChain | null,
      isOpen: false,
      setLiveSnapshot: () => {},
      appendAuditEvent: () => {},
      setDecisionChain: () => {},
      clearLiveAnalysis: () => {},
      setIsOpen: () => {},
    };
  }
  return ctx;
}
