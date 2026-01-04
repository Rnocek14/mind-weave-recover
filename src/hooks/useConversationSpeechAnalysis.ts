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
    
    // Initialize fluency score (will be enhanced with pronunciation data)
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
    
    // Detect effortful speech
    let effortfulSpeech = 
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
    
    // Initialize pronunciation data
    let microFluency: MicroFluencyAnalysis | null = null;
    let errorPattern: ErrorClassificationResult | null = null;
    let pronunciationScore: number | null = null;
    let phonemeAccuracy: { phoneme: string; score: number }[] = [];
    let challengingSounds: string[] = [];
    
    // Call Azure pronunciation analysis if we have audio
    if (audioBlob && audioBlob.size > 1000 && transcript.trim().length > 0) {
      try {
        console.log('[SpeechAnalysis] Calling pronunciation analysis with audio blob', { 
          size: audioBlob.size,
          transcript: transcript.slice(0, 30)
        });
        
        const audioBase64 = await blobToBase64(audioBlob);
        
        const { data, error } = await supabase.functions.invoke('analyze-pronunciation', {
          body: { 
            audioBlob: audioBase64,
            mimeType: audioBlob.type,
            referenceText: transcript
          }
        });
        
        if (error) {
          console.warn('[SpeechAnalysis] Pronunciation API error:', error);
        } else if (data?.ok && data.data) {
          console.log('[SpeechAnalysis] Pronunciation analysis success', {
            pronunciationScore: data.data.pronunciationScore,
            fluencyScore: data.data.fluencyScore,
            wordCount: data.data.words?.length
          });
          
          // Extract pronunciation metrics
          pronunciationScore = data.data.pronunciationScore;
          
          // Use Azure fluency score to enhance our calculation
          if (data.data.fluencyScore !== undefined) {
            // Blend Azure fluency with our heuristic
            fluencyScore = Math.round((fluencyScore + data.data.fluencyScore) / 2);
          }
          
          // Extract phoneme-level accuracy
          if (data.data.words) {
            for (const word of data.data.words) {
              if (word.phonemes) {
                for (const p of word.phonemes) {
                  phonemeAccuracy.push({
                    phoneme: p.phoneme,
                    score: p.accuracyScore
                  });
                  
                  // Track challenging sounds (below 70%)
                  if (p.accuracyScore < 70) {
                    if (!challengingSounds.includes(p.phoneme)) {
                      challengingSounds.push(p.phoneme);
                    }
                  }
                }
              }
            }
          }
          
          // Derive micro-fluency from alignment data
          if (data.data.alignmentData) {
            microFluency = deriveMicroFluency(data.data.alignmentData, transcript);
            
            // Update effortful speech based on micro-fluency
            if (microFluency && microFluency.quality.alignmentOk) {
              if (microFluency.longestPauseMs > 2000 || microFluency.preWordPauses.avgMs > 800) {
                effortfulSpeech = true;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[SpeechAnalysis] Pronunciation analysis failed:', err);
      }
    }
    
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
    
    // Final fluency score clamping
    fluencyScore = Math.max(0, Math.min(100, Math.round(fluencyScore)));
    
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
      pronunciationScore,
      phonemeAccuracy,
      challengingSounds,
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
