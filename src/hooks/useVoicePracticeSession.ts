/**
 * useVoicePracticeSession — manages the voice-only practice flow
 * 
 * Flow:
 * 1. Maya speaks session opening
 * 2. Maya introduces first game + speaks prompt
 * 3. User responds (speech recognition)
 * 4. Maya scores + gives feedback
 * 5. Maya transitions to next game
 * 6. Repeat until all rounds done
 * 7. Maya speaks closing summary
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import {
  buildVoiceSessionPlan,
  scoreVoiceRound,
  getSessionOpening,
  getSessionClosing,
  pickTransition,
  VoiceGameRound,
  VoiceSessionPlan,
} from '@/lib/voiceSessionController';
import type { VoiceGameType } from '@/data/voiceGames';

export type VoicePracticePhase = 
  | 'ready'       // Waiting to start
  | 'speaking'    // Maya is talking
  | 'listening'   // Waiting for user response
  | 'scoring'     // Processing response
  | 'feedback'    // Maya giving feedback
  | 'transition'  // Between games
  | 'complete';   // Session done

export interface VoiceRoundResult {
  gameType: VoiceGameType;
  label: string;
  transcript: string;
  score: number;
  feedback: string;
  matchedCount: number;
  totalExpected: number;
}

export interface UseVoicePracticeReturn {
  phase: VoicePracticePhase;
  currentRound: VoiceGameRound | null;
  currentIndex: number;
  totalRounds: number;
  results: VoiceRoundResult[];
  avgScore: number;
  isMayaSpeaking: boolean;
  /** What Maya is currently saying (for optional subtitle display) */
  currentMayaText: string;
  /** Start the session */
  startSession: () => Promise<void>;
  /** Submit user transcript for current round */
  submitResponse: (transcript: string) => Promise<void>;
  /** Skip current round */
  skipRound: () => Promise<void>;
  /** End session early */
  endSession: () => void;
}

export function useVoicePracticeSession(
  roundCount: number = 6,
  difficulty: number = 1,
): UseVoicePracticeReturn {
  const { speak, isSpeaking, stop: stopTTS } = useTextToSpeech();
  
  const [phase, setPhase] = useState<VoicePracticePhase>('ready');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<VoiceRoundResult[]>([]);
  const [currentMayaText, setCurrentMayaText] = useState('');
  
  const planRef = useRef<VoiceSessionPlan | null>(null);
  const isProcessingRef = useRef(false);

  // Build session plan on mount
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

  // Helper: Maya speaks and updates subtitle
  const mayaSpeak = useCallback(async (text: string) => {
    setCurrentMayaText(text);
    try {
      await speak(text);
    } catch (e) {
      console.warn('[VoicePractice] TTS failed:', e);
    }
    setCurrentMayaText('');
  }, [speak]);

  const startSession = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    setPhase('speaking');
    
    // Opening
    const opening = getSessionOpening();
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
    
    // Score the response
    const result = scoreVoiceRound(currentRound, transcript);
    
    const roundResult: VoiceRoundResult = {
      gameType: currentRound.gameType,
      label: currentRound.label,
      transcript,
      score: result.score,
      feedback: result.feedback,
      matchedCount: result.matchedCount,
      totalExpected: result.totalExpected,
    };
    
    setResults(prev => [...prev, roundResult]);
    
    // Give feedback
    setPhase('feedback');
    await mayaSpeak(result.feedback);
    
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
    
    // Transition to next game
    setPhase('transition');
    const transition = pickTransition();
    await mayaSpeak(transition);
    
    setCurrentIndex(nextIdx);
    const nextRound = plan.rounds[nextIdx];
    
    setPhase('speaking');
    // Only speak intro if game type changed
    if (nextRound.gameType !== currentRound.gameType) {
      await mayaSpeak(nextRound.intro);
    }
    await mayaSpeak(nextRound.prompt);
    
    setPhase('listening');
    isProcessingRef.current = false;
  }, [currentRound, currentIndex, plan, results, mayaSpeak]);

  const skipRound = useCallback(async () => {
    if (isProcessingRef.current || !currentRound) return;
    isProcessingRef.current = true;
    
    // Record skip
    setResults(prev => [...prev, {
      gameType: currentRound.gameType,
      label: currentRound.label,
      transcript: '',
      score: 0,
      feedback: 'Skipped',
      matchedCount: 0,
      totalExpected: currentRound.expectedAnswers.length,
    }]);
    
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

  // Cleanup
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
    startSession,
    submitResponse,
    skipRound,
    endSession,
  };
}
