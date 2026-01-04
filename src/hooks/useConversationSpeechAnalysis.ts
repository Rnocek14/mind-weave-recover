/**
 * useConversationSpeechAnalysis - Real-time speech analysis for Conversation Coach
 * 
 * Analyzes each user utterance for clinical patterns:
 * - Fluency metrics (pauses, speech rate)
 * - Error classification (circumlocution, effortful speech)
 * - Effort detection
 */

import { useCallback, useRef } from 'react';
import { classifySpeechError, ErrorClassificationResult } from '@/lib/errorClassifier';
import { deriveMicroFluency, MicroFluencyAnalysis } from '@/lib/microFluencyAnalyzer';
import { supabase } from '@/integrations/supabase/client';

export interface ConversationUtteranceAnalysis {
  transcript: string;
  wordCount: number;
  
  // Fluency metrics
  fluencyScore: number; // 0-100
  effortfulSpeech: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  filledPauseCount: number;
  
  // Clinical classification
  errorPattern: ErrorClassificationResult | null;
  circumlocutionDetected: boolean;
  
  // Confidence
  completionConfidence: 'high' | 'medium' | 'low';
  
  // Timing
  latencyToFirstWordMs: number | null;
  totalDurationMs: number | null;
  speechRateWpm: number | null;
  
  // Raw data for AI context
  microFluency: MicroFluencyAnalysis | null;
}

export interface ConversationSpeechContext {
  userId: string;
  profileId: string;
  sessionId: string | null;
  challengingAreas?: string[];
  predominantErrorPattern?: 'semantic' | 'phonemic' | 'mixed' | 'unknown';
  bestCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
}

export function useConversationSpeechAnalysis(context: ConversationSpeechContext) {
  const analysisHistoryRef = useRef<ConversationUtteranceAnalysis[]>([]);
  const sessionStartRef = useRef<number>(Date.now());

  /**
   * Analyze a user utterance
   * Called after each turn with the transcript and timing info
   */
  const analyzeUtterance = useCallback(async (
    transcript: string,
    latencyToFirstWordMs: number | null,
    totalDurationMs: number | null,
    audioBlob?: Blob
  ): Promise<ConversationUtteranceAnalysis> => {
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    
    // Calculate speech rate (WPM)
    let speechRateWpm: number | null = null;
    if (totalDurationMs && wordCount > 0) {
      speechRateWpm = Math.round((wordCount / (totalDurationMs / 1000)) * 60);
    }
    
    // Calculate pause pattern based on latency and speech rate
    let pausePattern: 'fluent' | 'hesitant' | 'very_slow' = 'fluent';
    if (latencyToFirstWordMs) {
      if (latencyToFirstWordMs > 4000) {
        pausePattern = 'very_slow';
      } else if (latencyToFirstWordMs > 2000) {
        pausePattern = 'hesitant';
      }
    }
    // Also check speech rate
    if (speechRateWpm !== null && speechRateWpm < 40) {
      pausePattern = pausePattern === 'very_slow' ? 'very_slow' : 'hesitant';
    }
    
    // Detect filled pauses
    const fillerWords = ['um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know'];
    const filledPauseCount = words.filter(w => 
      fillerWords.includes(w.toLowerCase())
    ).length;
    
    // Calculate fluency score (0-100)
    let fluencyScore = 100;
    // Penalize for slow latency
    if (latencyToFirstWordMs) {
      fluencyScore -= Math.min(20, (latencyToFirstWordMs - 1000) / 100);
    }
    // Penalize for filled pauses
    fluencyScore -= Math.min(20, filledPauseCount * 5);
    // Penalize for very slow speech rate
    if (speechRateWpm !== null && speechRateWpm < 60) {
      fluencyScore -= Math.min(20, (60 - speechRateWpm));
    }
    fluencyScore = Math.max(0, Math.min(100, Math.round(fluencyScore)));
    
    // Detect effortful speech
    const effortfulSpeech = 
      (latencyToFirstWordMs !== null && latencyToFirstWordMs > 3000) ||
      (speechRateWpm !== null && speechRateWpm < 30) ||
      pausePattern === 'very_slow';
    
    // Detect circumlocution (multi-word indirect reference)
    const circumlocutionPhrases = [
      'the thing', 'you know the', 'it has', 'you use it', 
      'kind of', 'sort of', 'that thing', 'what do you call'
    ];
    const lowerTranscript = transcript.toLowerCase();
    const circumlocutionDetected = circumlocutionPhrases.some(phrase => 
      lowerTranscript.includes(phrase)
    );
    
    // Determine completion confidence
    let completionConfidence: 'high' | 'medium' | 'low' = 'high';
    if (wordCount < 3) {
      completionConfidence = 'low';
    } else if (pausePattern === 'very_slow' || effortfulSpeech) {
      completionConfidence = 'medium';
    }
    
    // Try to get pronunciation analysis if we have audio
    let microFluency: MicroFluencyAnalysis | null = null;
    let errorPattern: ErrorClassificationResult | null = null;
    
    // For conversation coach, we don't have a specific target word,
    // but we can still do basic error classification if transcript suggests issues
    if (transcript.length > 0 && circumlocutionDetected) {
      // Mark as circumlocution without needing target word
      errorPattern = {
        errorType: 'circumlocution',
        confidence: 0.7,
        reasoning: 'Circumlocution phrase detected in conversational speech',
        needs_review: false,
        circumlocutionDetected: true,
        meaningAccuracy: 0.8,
        fluencyMetrics: {
          speechRateWpm: speechRateWpm ?? undefined,
          pauseCount: filledPauseCount,
          avgPauseDurationMs: latencyToFirstWordMs ?? undefined,
          effortfulSpeech,
        }
      };
    }
    
    const analysis: ConversationUtteranceAnalysis = {
      transcript,
      wordCount,
      fluencyScore,
      effortfulSpeech,
      pausePattern,
      filledPauseCount,
      errorPattern,
      circumlocutionDetected,
      completionConfidence,
      latencyToFirstWordMs,
      totalDurationMs,
      speechRateWpm,
      microFluency,
    };
    
    // Store in history
    analysisHistoryRef.current.push(analysis);
    // Keep last 10 analyses
    if (analysisHistoryRef.current.length > 10) {
      analysisHistoryRef.current.shift();
    }
    
    return analysis;
  }, []);

  /**
   * Get aggregated session metrics
   */
  const getSessionMetrics = useCallback(() => {
    const history = analysisHistoryRef.current;
    if (history.length === 0) {
      return null;
    }
    
    const avgFluency = Math.round(
      history.reduce((sum, a) => sum + a.fluencyScore, 0) / history.length
    );
    const effortfulCount = history.filter(a => a.effortfulSpeech).length;
    const circumlocutionCount = history.filter(a => a.circumlocutionDetected).length;
    const avgWordCount = Math.round(
      history.reduce((sum, a) => sum + a.wordCount, 0) / history.length
    );
    const validLatencies = history
      .map(a => a.latencyToFirstWordMs)
      .filter((l): l is number => l !== null);
    const avgLatency = validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : null;
    
    // Calculate fluency trend (first half vs second half)
    let fluencyTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (history.length >= 4) {
      const mid = Math.floor(history.length / 2);
      const firstHalf = history.slice(0, mid);
      const secondHalf = history.slice(mid);
      const firstAvg = firstHalf.reduce((s, a) => s + a.fluencyScore, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, a) => s + a.fluencyScore, 0) / secondHalf.length;
      if (secondAvg > firstAvg + 5) {
        fluencyTrend = 'improving';
      } else if (secondAvg < firstAvg - 5) {
        fluencyTrend = 'declining';
      }
    }
    
    return {
      avgFluency,
      effortfulCount,
      circumlocutionCount,
      avgWordCount,
      avgLatency,
      fluencyTrend,
      totalUtterances: history.length,
      sessionDurationMs: Date.now() - sessionStartRef.current,
    };
  }, []);

  /**
   * Build speech context for AI prompt
   */
  const buildAISpeechContext = useCallback((analysis: ConversationUtteranceAnalysis): string => {
    const parts: string[] = [];
    
    // Effort level
    if (analysis.effortfulSpeech) {
      parts.push(`HIGH effort (${analysis.latencyToFirstWordMs ? Math.round(analysis.latencyToFirstWordMs / 1000) + 's pause' : 'slow speech'})`);
    } else if (analysis.pausePattern === 'hesitant') {
      parts.push('Moderate effort');
    }
    
    // Filled pauses
    if (analysis.filledPauseCount >= 2) {
      parts.push(`${analysis.filledPauseCount} filled pauses`);
    }
    
    // Circumlocution
    if (analysis.circumlocutionDetected) {
      parts.push('Word-finding difficulty (used descriptions instead of words)');
    }
    
    // Completion
    if (analysis.completionConfidence === 'low') {
      parts.push('Very brief response');
    } else if (analysis.wordCount > 15) {
      parts.push('Strong detailed response');
    }
    
    if (parts.length === 0) {
      return 'Clear, flowing speech';
    }
    
    return parts.join('; ');
  }, []);

  /**
   * Reset for new session
   */
  const reset = useCallback(() => {
    analysisHistoryRef.current = [];
    sessionStartRef.current = Date.now();
  }, []);

  return {
    analyzeUtterance,
    getSessionMetrics,
    buildAISpeechContext,
    reset,
    analysisHistory: analysisHistoryRef.current,
  };
}
