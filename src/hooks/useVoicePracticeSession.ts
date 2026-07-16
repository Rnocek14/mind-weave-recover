/**
 * useVoicePracticeSession — manages the voice-only practice flow
 * 
 * V2: Conversational wrapper with topic threading, progress feedback,
 * purpose anchors, follow-up loops, and P0 telemetry emission.
 * 
 * Flow:
 * 1. Pick a topic → Maya speaks topic-aware opener
 * 2. Maya introduces first game + speaks prompt
 * 3. User responds (speech recognition)
 * 4. Maya scores + gives SPECIFIC progress feedback
 * 5. Maya optionally asks a follow-up (conversation loop)
 * 6. Maya transitions conversationally to next game
 * 7. Every ~3 rounds, Maya drops a purpose anchor
 * 8. Session close with purpose reinforcement
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import {
  buildVoiceSessionPlan,
  scoreVoiceRound,
  getSessionOpening,
  getSessionClosing,
  pickTransition,
  getPurposeAnchor,
  getProgressFeedback,
  getFollowUp,
  extractMemorySnippet,
  getMemoryCallback,
  VoiceGameRound,
  VoiceSessionPlan,
} from '@/lib/voiceSessionController';
import type { VoiceGameType, SessionTopic } from '@/data/voiceGames';
import { supabase } from '@/integrations/supabase/client';

export type VoicePracticePhase = 
  | 'ready'              // Waiting to start
  | 'speaking'           // Maya is talking
  | 'listening'          // Waiting for user response
  | 'scoring'            // Processing response
  | 'feedback'           // Maya giving feedback
  | 'listening_followup' // Waiting for follow-up response (multi-turn loop)
  | 'transition'         // Between games
  | 'complete';          // Session done

export interface VoiceRoundResult {
  gameType: VoiceGameType;
  label: string;
  transcript: string;
  score: number;
  feedback: string;
  matchedCount: number;
  totalExpected: number;
  wordCount: number;
}

export interface UseVoicePracticeReturn {
  phase: VoicePracticePhase;
  currentRound: VoiceGameRound | null;
  currentIndex: number;
  totalRounds: number;
  results: VoiceRoundResult[];
  avgScore: number;
  isMayaSpeaking: boolean;
  currentMayaText: string;
  sessionTopic: string;
  startSession: () => Promise<void>;
  submitResponse: (transcript: string) => Promise<void>;
  submitFollowUp: (transcript: string) => Promise<void>;
  skipRound: () => Promise<void>;
  endSession: () => void;
}

export function useVoicePracticeSession(
  roundCount: number = 6,
  difficulty: number = 1,
  sessionId?: string,
  profileId?: string,
): UseVoicePracticeReturn {
  const { speak, isSpeaking, stop: stopTTS } = useTextToSpeech();
  
  const [phase, setPhase] = useState<VoicePracticePhase>('ready');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<VoiceRoundResult[]>([]);
  const [currentMayaText, setCurrentMayaText] = useState('');
  
  const planRef = useRef<VoiceSessionPlan | null>(null);
  const isProcessingRef = useRef(false);
  const scoresHistoryRef = useRef<number[]>([]);
  const pendingFollowUpRef = useRef(false); // tracks if we're in a follow-up loop
  const memorySnippetsRef = useRef<string[]>([]); // stores meaningful content from user responses

  const plan = useMemo(() => {
    const p = buildVoiceSessionPlan(roundCount, difficulty);
    planRef.current = p;
    return p;
  }, [roundCount, difficulty]);

  const currentRound = plan.rounds[currentIndex] ?? null;

  const avgScore = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.score, 0) / results.length;
  }, [results]);

  // Maya speaks and updates subtitle
  const mayaSpeak = useCallback(async (text: string) => {
    setCurrentMayaText(text);
    try {
      await speak(text);
    } catch (e) {
      console.warn('[VoicePractice] TTS failed:', e);
    }
    setCurrentMayaText('');
  }, [speak]);

  // ─── P0 Telemetry: emit exercise_event for each round ───
  const emitVoicePracticeEvent = useCallback(async (
    round: VoiceGameRound,
    roundResult: VoiceRoundResult,
    roundIndex: number,
  ) => {
    if (!sessionId) return;
    try {
      const isCorrect = roundResult.score >= 0.5;
      const resolvedErrorType: string = isCorrect
        ? 'correct'
        : (roundResult.wordCount === 0 ? 'no_response' : 'low_match');

      // ── Voice Engine v2 QUARANTINE (docs/voice-engine-v2-spec.md §11) ──
      // scoreVoiceRound is a word-count/keyword heuristic, not clinical
      // measurement. These rows are PARTICIPATION-ONLY: counts_toward_score is
      // false so they never feed accuracy, progression, or adaptation. The raw
      // heuristic number is preserved in outputs.heuristic_score for reference.
      // Voice Practice is rebuilt on the CIU concept-coverage path in V2.2.
      await supabase.from('exercise_events').insert({
        session_id: sessionId,
        profile_id: profileId ?? null,
        exercise_slug: 'voice_practice',
        round: roundIndex + 1,
        // 0–100 scale (canonical exercise_events.score) — roundResult.score is 0–1.
        // Kept for telemetry continuity, but quarantined from every scored
        // aggregate by counts_toward_score:false + the slug exclusion in
        // sessionAccuracySummary.
        score: Math.round(roundResult.score * 100),
        counts_toward_score: false,
        error_type: resolvedErrorType,
        engine_version: 'v1',
        inputs: {
          transcript: roundResult.transcript,
          word_count: roundResult.wordCount,
          game_type: round.gameType,
          error_type: resolvedErrorType,
        },
        outputs: {
          feedback: roundResult.feedback,
          matched_count: roundResult.matchedCount,
          total_expected: roundResult.totalExpected,
          heuristic_score: roundResult.score,
          unscored_practice: true,
        },
        engagement_flags: {
          did_speak: roundResult.wordCount > 0,
          meaningful_response: roundResult.wordCount >= 3,
          event_subtype: 'voice_practice',
          game_type: round.gameType,
          session_topic: plan.topic.topic,
          arc_phase: round.arcPhase,
          unscored_practice: true,
          counts_toward_score: false,
        },
        task_parameters: {
          event_subtype: 'voice_practice',
          game_type: round.gameType,
          session_topic: plan.topic.topic,
          arc_phase: round.arcPhase,
          difficulty,
          fluency_unavailable_reason: 'voice_practice_task',
          unscored_practice: true,
          quarantine_reason: 'voice_practice_heuristic_scoring_v2_spec_s11',
        },
        // Cast: engine_version predates the next supabase type regen.
      } as any);
    } catch (err) {
      console.warn('[VoicePractice] Telemetry emit failed:', err);
    }
  }, [sessionId, profileId, plan.topic.topic, difficulty]);

  const startSession = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    setPhase('speaking');
    
    // Topic-aware opening
    const opening = getSessionOpening(plan.topic);
    await mayaSpeak(opening);
    
    // First game intro + prompt
    const round = plan.rounds[0];
    if (round) {
      await mayaSpeak(round.intro);
      await mayaSpeak(round.prompt);
    }
    
    setPhase('listening');
    isProcessingRef.current = false;
  }, [plan, mayaSpeak]);

  // ─── Advance to next round (shared by submitResponse and submitFollowUp) ───
  const advanceToNext = useCallback(async () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= plan.rounds.length) {
      setPhase('speaking');
      const avg = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
      const closing = getSessionClosing(results.length, avg);
      await mayaSpeak(closing);
      setPhase('complete');
      isProcessingRef.current = false;
      return;
    }

    setPhase('transition');
    const nextRound = plan.rounds[nextIdx];
    const prevPhase = currentRound?.arcPhase;
    const nextPhase = nextRound.arcPhase;
    const phaseChanged = prevPhase !== nextPhase;
    
    // Memory callback — reference earlier user content when entering a new phase
    if (phaseChanged && memorySnippetsRef.current.length > 0) {
      const callback = getMemoryCallback(nextPhase, memorySnippetsRef.current);
      if (callback) {
        await mayaSpeak(callback);
      }
    } else {
      await mayaSpeak(pickTransition(prevPhase, nextPhase, plan.topic));
    }

    if ((nextIdx) % 3 === 0) {
      await mayaSpeak(getPurposeAnchor());
    }

    setCurrentIndex(nextIdx);
    setPhase('speaking');
    // Only re-introduce when arc phase changes (new type of activity)
    if (phaseChanged) {
      await mayaSpeak(nextRound.intro);
    }
    await mayaSpeak(nextRound.prompt);
    setPhase('listening');
    isProcessingRef.current = false;
  }, [currentIndex, plan, results, currentRound, mayaSpeak]);

  const submitResponse = useCallback(async (transcript: string) => {
    if (isProcessingRef.current || !currentRound) return;
    isProcessingRef.current = true;
    
    setPhase('scoring');
    
    const result = scoreVoiceRound(currentRound, transcript);
    
    const roundResult: VoiceRoundResult = {
      gameType: currentRound.gameType,
      label: currentRound.label,
      transcript,
      score: result.score,
      feedback: result.feedback,
      matchedCount: result.matchedCount,
      totalExpected: result.totalExpected,
      wordCount: result.wordCount,
    };
    
    setResults(prev => [...prev, roundResult]);
    scoresHistoryRef.current.push(result.score);
    
    // Store memory snippet for later arc callbacks
    const snippet = extractMemorySnippet(transcript);
    if (snippet) {
      memorySnippetsRef.current.push(snippet);
    }
    
    emitVoicePracticeEvent(currentRound, roundResult, currentIndex);
    
    setPhase('feedback');
    await mayaSpeak(result.feedback);
    
    const progressFB = getProgressFeedback(
      result.score,
      result.wordCount,
      currentRound.gameType,
      scoresHistoryRef.current.slice(0, -1),
    );
    if (progressFB) {
      await mayaSpeak(progressFB);
    }
    
    // Follow-up loop — real interactive multi-turn
    const shouldFollowUp = currentRound.followUp && result.score >= 0.3 && Math.random() > 0.5;
    if (shouldFollowUp) {
      await mayaSpeak(currentRound.followUp!);
      pendingFollowUpRef.current = true;
      setPhase('listening_followup');
      isProcessingRef.current = false;
      return;
    }
    
    await advanceToNext();
  }, [currentRound, currentIndex, plan, results, mayaSpeak, emitVoicePracticeEvent, advanceToNext]);

  const skipRound = useCallback(async () => {
    if (isProcessingRef.current || !currentRound) return;
    isProcessingRef.current = true;
    
    setResults(prev => [...prev, {
      gameType: currentRound.gameType,
      label: currentRound.label,
      transcript: '',
      score: 0,
      feedback: 'Skipped',
      matchedCount: 0,
      totalExpected: currentRound.expectedAnswers.length,
      wordCount: 0,
    }]);
    scoresHistoryRef.current.push(0);
    
    const nextIdx = currentIndex + 1;
    if (nextIdx >= plan.rounds.length) {
      setPhase('complete');
      isProcessingRef.current = false;
      return;
    }
    
    setCurrentIndex(nextIdx);
    const nextRound = plan.rounds[nextIdx];
    
    setPhase('speaking');
    await mayaSpeak("No problem. Let's try this one instead.");
    if (nextRound.gameType !== currentRound.gameType) {
      await mayaSpeak(nextRound.intro);
    }
    await mayaSpeak(nextRound.prompt);
    
    setPhase('listening');
    isProcessingRef.current = false;
  }, [currentRound, currentIndex, plan, mayaSpeak]);

  const submitFollowUp = useCallback(async (transcript: string) => {
    if (isProcessingRef.current || !pendingFollowUpRef.current) return;
    isProcessingRef.current = true;
    pendingFollowUpRef.current = false;

    setPhase('feedback');

    const wordCount = transcript ? transcript.trim().split(/\s+/).filter(w => w.length > 1).length : 0;

    if (wordCount >= 3) {
      // Acknowledge the follow-up with progress-style feedback
      const followUpFeedback = [
        "Nice — you added more to that. That's exactly how real conversations work.",
        "Good. You expanded on that well.",
        "That was a fuller answer. This kind of practice really helps.",
        "You said more that time. That's progress.",
      ];
      await mayaSpeak(followUpFeedback[Math.floor(Math.random() * followUpFeedback.length)]);
    } else if (wordCount > 0) {
      await mayaSpeak("Good try. Even a short answer counts.");
    } else {
      await mayaSpeak("That's okay. Let's move on.");
    }

    // Now advance to next round
    await advanceToNext();
  }, [advanceToNext, mayaSpeak]);

  const endSession = useCallback(() => {
    stopTTS();
    pendingFollowUpRef.current = false;
    setPhase('complete');
  }, [stopTTS]);

  useEffect(() => {
    return () => { stopTTS(); };
  }, [stopTTS]);

  return {
    phase,
    currentRound,
    currentIndex,
    totalRounds: plan.totalRounds,
    results,
    avgScore,
    isMayaSpeaking: isSpeaking,
    currentMayaText,
    sessionTopic: plan.topic.label,
    startSession,
    submitResponse,
    submitFollowUp,
    skipRound,
    endSession,
  };
}
