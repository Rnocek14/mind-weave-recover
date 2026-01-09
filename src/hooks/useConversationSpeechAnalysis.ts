/**
 * useConversationSpeechAnalysis - Real-time speech analysis for Conversation Coach
 * 
 * Analyzes each user utterance for clinical patterns:
 * - Fluency metrics (pauses, speech rate)
 * - Error classification (circumlocution, effortful speech)
 * - Pronunciation analysis via Azure API
 * - Micro-fluency from alignment data
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
  
  // Pronunciation data (when audio available)
  pronunciationScore: number | null;
  phonemeAccuracy: { phoneme: string; score: number }[];
  challengingSounds: string[];
}

export interface ConversationSpeechContext {
  userId: string;
  profileId: string;
  sessionId: string | null;
  challengingAreas?: string[];
  predominantErrorPattern?: 'semantic' | 'phonemic' | 'mixed' | 'unknown';
  bestCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
}

// Helper to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useConversationSpeechAnalysis(context: ConversationSpeechContext) {
  const analysisHistoryRef = useRef<ConversationUtteranceAnalysis[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const pendingPronunciationRef = useRef<{
    pronunciationScore: number | null;
    phonemeAccuracy: { phoneme: string; score: number }[];
    challengingSounds: string[];
  } | null>(null);

  /**
   * Quick analysis - returns immediately for fast AI response
   * Does NOT wait for pronunciation API
   */
  const analyzeUtteranceQuick = useCallback((
    transcript: string,
    latencyToFirstWordMs: number | null,
    totalDurationMs: number | null
  ): ConversationUtteranceAnalysis => {
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
    if (speechRateWpm !== null && speechRateWpm < 40) {
      pausePattern = pausePattern === 'very_slow' ? 'very_slow' : 'hesitant';
    }
    
    // Detect filled pauses
    const fillerWords = ['um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know'];
    const filledPauseCount = words.filter(w => 
      fillerWords.includes(w.toLowerCase())
    ).length;
    
    // Initialize fluency score (heuristic only - fast)
    let fluencyScore = 100;
    if (latencyToFirstWordMs) {
      fluencyScore -= Math.min(20, (latencyToFirstWordMs - 1000) / 100);
    }
    fluencyScore -= Math.min(20, filledPauseCount * 5);
    if (speechRateWpm !== null && speechRateWpm < 60) {
      fluencyScore -= Math.min(20, (60 - speechRateWpm));
    }
    
    // Detect effortful speech
    const effortfulSpeech = 
      (latencyToFirstWordMs !== null && latencyToFirstWordMs > 3000) ||
      (speechRateWpm !== null && speechRateWpm < 30) ||
      pausePattern === 'very_slow';
    
    // Detect circumlocution
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

    // Use cached pronunciation data from previous turn (if available)
    const cachedPron = pendingPronunciationRef.current;
    
    const analysis: ConversationUtteranceAnalysis = {
      transcript,
      wordCount,
      fluencyScore: Math.max(0, Math.min(100, Math.round(fluencyScore))),
      effortfulSpeech,
      pausePattern,
      filledPauseCount,
      errorPattern: circumlocutionDetected ? {
        errorType: 'circumlocution',
        confidence: 0.7,
        reasoning: 'Circumlocution phrase detected',
        needs_review: false,
        circumlocutionDetected: true,
        meaningAccuracy: 0.8,
        fluencyMetrics: {
          speechRateWpm: speechRateWpm ?? undefined,
          pauseCount: filledPauseCount,
          avgPauseDurationMs: latencyToFirstWordMs ?? undefined,
          effortfulSpeech,
        }
      } : null,
      circumlocutionDetected,
      completionConfidence,
      latencyToFirstWordMs,
      totalDurationMs,
      speechRateWpm,
      microFluency: null,
      // Use cached pronunciation from previous analysis
      pronunciationScore: cachedPron?.pronunciationScore ?? null,
      phonemeAccuracy: cachedPron?.phonemeAccuracy ?? [],
      challengingSounds: cachedPron?.challengingSounds ?? [],
    };
    
    // Store in history
    analysisHistoryRef.current.push(analysis);
    if (analysisHistoryRef.current.length > 10) {
      analysisHistoryRef.current.shift();
    }
    
    return analysis;
  }, []);

  /**
   * Run pronunciation analysis in background - results used for NEXT turn
   * This is fire-and-forget, doesn't block the AI response
   */
  const analyzePronunciationAsync = useCallback((
    transcript: string,
    audioBlob: Blob
  ) => {
    // Only run every 2nd turn to reduce load, or if we have no cached data
    const shouldAnalyze = analysisHistoryRef.current.length % 2 === 0 || 
                          pendingPronunciationRef.current === null;
    
    if (!shouldAnalyze || audioBlob.size < 1000 || transcript.trim().length === 0) {
      return;
    }

    // Fire and forget - run in background
    (async () => {
      try {
        console.log('[SpeechAnalysis] Background pronunciation analysis starting');
        const audioBase64 = await blobToBase64(audioBlob);
        
        const { data, error } = await supabase.functions.invoke('analyze-pronunciation', {
          body: { 
            audioBlob: audioBase64,
            mimeType: audioBlob.type,
            referenceText: transcript
          }
        });
        
        if (!error && data?.ok && data.data) {
          const phonemeAccuracy: { phoneme: string; score: number }[] = [];
          const challengingSounds: string[] = [];
          
          if (data.data.words) {
            for (const word of data.data.words) {
              if (word.phonemes) {
                for (const p of word.phonemes) {
                  phonemeAccuracy.push({ phoneme: p.phoneme, score: p.accuracyScore });
                  if (p.accuracyScore < 70 && !challengingSounds.includes(p.phoneme)) {
                    challengingSounds.push(p.phoneme);
                  }
                }
              }
            }
          }
          
          // Cache for next turn
          pendingPronunciationRef.current = {
            pronunciationScore: data.data.pronunciationScore,
            phonemeAccuracy,
            challengingSounds,
          };
          console.log('[SpeechAnalysis] Background analysis cached:', pendingPronunciationRef.current);
        }
      } catch (err) {
        console.warn('[SpeechAnalysis] Background pronunciation failed:', err);
      }
    })();
  }, []);

  /**
   * Legacy method - now just calls quick analysis + starts background pronunciation
   */
  const analyzeUtterance = useCallback(async (
    transcript: string,
    latencyToFirstWordMs: number | null,
    totalDurationMs: number | null,
    audioBlob?: Blob
  ): Promise<ConversationUtteranceAnalysis> => {
    // Get quick analysis immediately (no await on pronunciation)
    const analysis = analyzeUtteranceQuick(transcript, latencyToFirstWordMs, totalDurationMs);
    
    // Start pronunciation analysis in background for next turn
    if (audioBlob) {
      analyzePronunciationAsync(transcript, audioBlob);
    }
    
    return analysis;
  }, [analyzeUtteranceQuick, analyzePronunciationAsync]);

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
    
    // Aggregate pronunciation data
    const validPronScores = history
      .map(a => a.pronunciationScore)
      .filter((p): p is number => p !== null);
    const avgPronunciationScore = validPronScores.length > 0
      ? Math.round(validPronScores.reduce((a, b) => a + b, 0) / validPronScores.length)
      : null;
    
    // Collect all challenging sounds from session
    const allChallengingSounds = history
      .flatMap(a => a.challengingSounds)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 5);
    
    // Find best utterances (high fluency, good word count)
    const bestUtterances = history
      .filter(a => a.fluencyScore >= 75 && a.wordCount >= 5)
      .map(a => a.transcript)
      .slice(0, 3);
    
    return {
      avgFluency,
      effortfulCount,
      circumlocutionCount,
      avgWordCount,
      avgLatency,
      fluencyTrend,
      totalUtterances: history.length,
      sessionDurationMs: Date.now() - sessionStartRef.current,
      // Enhanced metrics
      avgPronunciationScore,
      challengingSounds: allChallengingSounds,
      bestUtterances,
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
    
    // Pronunciation quality
    if (analysis.pronunciationScore !== null) {
      if (analysis.pronunciationScore >= 85) {
        parts.push('Clear pronunciation');
      } else if (analysis.pronunciationScore < 60) {
        parts.push('Some pronunciation difficulty');
      }
    }
    
    // Challenging sounds
    if (analysis.challengingSounds.length > 0) {
      parts.push(`Challenging sounds: ${analysis.challengingSounds.slice(0, 3).join(', ')}`);
    }
    
    // Micro-fluency insights
    if (analysis.microFluency?.quality.alignmentOk) {
      if (analysis.microFluency.preWordPauses.count > 2) {
        parts.push('Pre-word hesitations suggest word retrieval difficulty');
      }
      if (analysis.microFluency.intraWordPauses.count > 0) {
        parts.push('Intra-word pauses (possible motor planning)');
      }
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
