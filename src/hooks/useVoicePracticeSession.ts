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
      await supabase.from('exercise_events').insert({
        session_id: sessionId,
        exercise_slug: 'voice-practice',
        round: roundIndex + 1,
        score: Math.round(roundResult.score * 100) / 100,
        inputs: {
          transcript: roundResult.transcript,
          word_count: roundResult.wordCount,
          game_type: round.gameType,
        },
        outputs: {
          feedback: roundResult.feedback,
          matched_count: roundResult.matchedCount,
          total_expected: roundResult.totalExpected,
        },
        engagement_flags: {
          did_speak: roundResult.wordCount > 0,
          meaningful_response: roundResult.wordCount >= 3,
          event_subtype: 'voice_practice',
          game_type: round.gameType,
          session_topic: plan.topic.topic,
        },
        task_parameters: {
          event_subtype: 'voice_practice',
          game_type: round.gameType,
          session_topic: plan.topic.topic,
          difficulty,
          fluency_unavailable_reason: 'voice_practice_task',
        },
      });
    } catch (err) {
      console.warn('[VoicePractice] Telemetry emit failed:', err);
    }
  }, [sessionId, plan.topic.topic, difficulty]);

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
    
    // ── Emit telemetry ──
    emitVoicePracticeEvent(currentRound, roundResult, currentIndex);
    
    // ── Feedback phase ──
    setPhase('feedback');
    
    // 1. Core feedback (always)
    await mayaSpeak(result.feedback);
    
    // 2. Specific progress feedback (when earned)
    const progressFB = getProgressFeedback(
      result.score,
      result.wordCount,
      currentRound.gameType,
      scoresHistoryRef.current.slice(0, -1),
    );
    if (progressFB) {
      await mayaSpeak(progressFB);
    }
    
    // 3. Follow-up loop — real interactive multi-turn
    // ~50% chance, only when game has a follow-up and user did okay
    const shouldFollowUp = currentRound.followUp && result.score >= 0.3 && Math.random() > 0.5;
    if (shouldFollowUp) {
      await mayaSpeak(currentRound.followUp!);
      pendingFollowUpRef.current = true;
      setPhase('listening_followup');
      isProcessingRef.current = false;
      return; // Wait for follow-up response via submitFollowUp
    }
    
    // Check if session is done
    const nextIdx = currentIndex + 1;
    if (nextIdx >= plan.rounds.length) {
      setPhase('speaking');
      const allResults = [...results, roundResult];
      const avg = allResults.reduce((s, r) => s + r.score, 0) / allResults.length;
      const closing = getSessionClosing(allResults.length, avg);
      await mayaSpeak(closing);
      setPhase('complete');
      isProcessingRef.current = false;
      return;
    }
    
    // ── Transition ──
    setPhase('transition');
    
    const nextRound = plan.rounds[nextIdx];
    const sameType = nextRound.gameType === currentRound.gameType;
    const transition = pickTransition(sameType);
    await mayaSpeak(transition);
    
    // 4. Purpose anchor (every ~3 rounds)
    if ((nextIdx) % 3 === 0) {
      await mayaSpeak(getPurposeAnchor());
    }
    
    setCurrentIndex(nextIdx);
    
    setPhase('speaking');
    if (!sameType) {
      await mayaSpeak(nextRound.intro);
    }
    await mayaSpeak(nextRound.prompt);
    
    setPhase('listening');
    isProcessingRef.current = false;
  }, [currentRound, currentIndex, plan, results, mayaSpeak, emitVoicePracticeEvent]);

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

  const endSession = useCallback(() => {
    stopTTS();
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
    skipRound,
    endSession,
  };
}
