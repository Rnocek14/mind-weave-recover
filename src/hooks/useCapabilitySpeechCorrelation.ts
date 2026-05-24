import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

interface CorrelationInsight {
  factor: string;
  correlation: 'positive' | 'negative' | 'neutral';
  strength: number; // 0-1
  description: string;
  recommendation?: string;
}

interface CrossDomainAnalytics {
  // Capability → Speech correlations
  attentionTimeoutCorrelation: CorrelationInsight | null;
  visionAccuracyCorrelation: CorrelationInsight | null;
  motorLatencyCorrelation: CorrelationInsight | null;
  
  // Speech pattern insights
  errorTypesByCapability: {
    lowAttention: { semantic: number; phonemic: number; timeout: number };
    lowVision: { semantic: number; phonemic: number; timeout: number };
    lowMotor: { semantic: number; phonemic: number; timeout: number };
  } | null;
  
  // Performance trends
  fatiguePattern: {
    firstHalfAccuracy: number;
    secondHalfAccuracy: number;
    dropoff: number;
    recommendation: string;
  } | null;
  
  // Best conditions
  optimalConditions: {
    bestTimeOfDay: string | null;
    bestSessionLength: number | null;
    bestCueType: string | null;
  };
  
  // Smart recommendations
  recommendations: string[];
}

interface UseCapabilitySpeechOptions {
  profileId?: string;
  enabled?: boolean;
}

export const useCapabilitySpeechCorrelation = (
  userId: string | null | undefined,
  options: UseCapabilitySpeechOptions = {}
) => {
  const { profileId: explicitProfileId, enabled = true } = options;
  const activeProfileId = useActiveProfileId();
  const profileId = explicitProfileId ?? activeProfileId;
  const [analytics, setAnalytics] = useState<CrossDomainAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);

      // Fetch capability assessment
      let capQ = supabase
        .from('capability_assessments')
        .select('vision_score, motor_score, attention_score')
        .eq('user_id', userId)
        .eq('completed', true)
        .order('assessed_at', { ascending: false })
        .limit(1);
      if (profileId) capQ = capQ.eq('profile_id', profileId);
      const { data: assessmentData } = await capQ.maybeSingle();

      // Fetch utterance analyses (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let uttQ = supabase
        .from('utterance_analyses')
        .select(`
          is_correct,
          error_type,
          cue_type_given,
          cue_was_effective,
          latency_ms,
          speech_rate_wpm,
          effortful_speech,
          created_at,
          session_id
        `)
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      if (profileId) uttQ = uttQ.eq('profile_id', profileId);
      const { data: utteranceData } = await uttQ;

      const utterances = utteranceData || [];
      const assessment = assessmentData;

      const recommendations: string[] = [];

      // Calculate attention → timeout correlation
      let attentionTimeoutCorrelation: CorrelationInsight | null = null;
      if (assessment?.attention_score !== undefined) {
        const timeoutRate = utterances.filter(u => u.error_type === 'timeout').length / Math.max(utterances.length, 1);
        const attentionScore = assessment.attention_score;
        
        if (attentionScore < 5 && timeoutRate > 0.2) {
          attentionTimeoutCorrelation = {
            factor: 'Attention → Timeouts',
            correlation: 'negative',
            strength: Math.min(1, timeoutRate * 2),
            description: `Low attention score (${attentionScore}/10) correlates with ${(timeoutRate * 100).toFixed(0)}% timeout rate`,
            recommendation: 'Consider shorter sessions with more frequent breaks',
          };
          recommendations.push('Shorter sessions may help reduce timeouts');
        } else if (attentionScore >= 7 && timeoutRate < 0.1) {
          attentionTimeoutCorrelation = {
            factor: 'Attention → Timeouts',
            correlation: 'positive',
            strength: 0.8,
            description: 'Good attention helps maintain focus throughout trials',
          };
        }
      }

      // Calculate vision → accuracy correlation
      let visionAccuracyCorrelation: CorrelationInsight | null = null;
      if (assessment?.vision_score !== undefined) {
        const accuracy = utterances.filter(u => u.is_correct).length / Math.max(utterances.length, 1);
        const visionScore = assessment.vision_score;
        
        if (visionScore < 5 && accuracy < 0.6) {
          visionAccuracyCorrelation = {
            factor: 'Vision → Accuracy',
            correlation: 'negative',
            strength: Math.min(1, (1 - accuracy) * 1.5),
            description: `Vision challenges (${visionScore}/10) may affect photo recognition`,
            recommendation: 'Left-side visual exercises may help improve awareness',
          };
          recommendations.push('Visual attention exercises recommended');
        }
      }

      // Calculate motor → latency correlation  
      let motorLatencyCorrelation: CorrelationInsight | null = null;
      if (assessment?.motor_score !== undefined) {
        const withLatency = utterances.filter(u => u.latency_ms);
        const avgLatency = withLatency.length > 0 
          ? withLatency.reduce((sum, u) => sum + (u.latency_ms || 0), 0) / withLatency.length 
          : null;
        
        if (avgLatency && assessment.motor_score < 5 && avgLatency > 3000) {
          motorLatencyCorrelation = {
            factor: 'Motor → Response Time',
            correlation: 'negative',
            strength: Math.min(1, avgLatency / 5000),
            description: `Motor challenges (${assessment.motor_score}/10) correlate with slower responses (${(avgLatency/1000).toFixed(1)}s avg)`,
            recommendation: 'Extended response windows recommended',
          };
          recommendations.push('Extended time windows may reduce pressure');
        }
      }

      // Calculate fatigue pattern (first half vs second half of sessions)
      let fatiguePattern: CrossDomainAnalytics['fatiguePattern'] = null;
      if (utterances.length >= 10) {
        const midpoint = Math.floor(utterances.length / 2);
        const firstHalf = utterances.slice(0, midpoint);
        const secondHalf = utterances.slice(midpoint);
        
        const firstHalfAccuracy = firstHalf.filter(u => u.is_correct).length / firstHalf.length;
        const secondHalfAccuracy = secondHalf.filter(u => u.is_correct).length / secondHalf.length;
        const dropoff = firstHalfAccuracy - secondHalfAccuracy;
        
        let recommendation = '';
        if (dropoff > 0.15) {
          recommendation = 'Consider shorter sessions - fatigue affects later performance';
          recommendations.push('Session fatigue detected - try shorter practice blocks');
        } else if (dropoff < -0.1) {
          recommendation = 'Great warmup pattern - performance improves with practice!';
        } else {
          recommendation = 'Consistent performance throughout sessions';
        }
        
        fatiguePattern = {
          firstHalfAccuracy,
          secondHalfAccuracy,
          dropoff,
          recommendation,
        };
      }

      // Calculate best cue type
      const cueStats = new Map<string, { effective: number; total: number }>();
      utterances.forEach(u => {
        if (u.cue_type_given) {
          const stats = cueStats.get(u.cue_type_given) || { effective: 0, total: 0 };
          stats.total++;
          if (u.cue_was_effective) stats.effective++;
          cueStats.set(u.cue_type_given, stats);
        }
      });

      let bestCueType: string | null = null;
      let bestEfficacy = 0;
      cueStats.forEach((stats, cueType) => {
        if (stats.total >= 3) {
          const efficacy = stats.effective / stats.total;
          if (efficacy > bestEfficacy) {
            bestEfficacy = efficacy;
            bestCueType = cueType;
          }
        }
      });

      if (bestCueType && bestEfficacy > 0.6) {
        recommendations.push(`${bestCueType} cues work best for you (${(bestEfficacy * 100).toFixed(0)}% effective)`);
      }

      // Error types by capability level (simplified)
      let errorTypesByCapability: CrossDomainAnalytics['errorTypesByCapability'] = null;
      if (assessment) {
        const semanticErrors = utterances.filter(u => u.error_type?.includes('semantic')).length;
        const phonemicErrors = utterances.filter(u => u.error_type?.includes('phonemic') || u.error_type?.includes('phonological')).length;
        const timeoutErrors = utterances.filter(u => u.error_type === 'timeout').length;
        
        errorTypesByCapability = {
          lowAttention: { 
            semantic: assessment.attention_score < 5 ? semanticErrors : 0,
            phonemic: assessment.attention_score < 5 ? phonemicErrors : 0,
            timeout: assessment.attention_score < 5 ? timeoutErrors : 0,
          },
          lowVision: {
            semantic: assessment.vision_score < 5 ? semanticErrors : 0,
            phonemic: assessment.vision_score < 5 ? phonemicErrors : 0,
            timeout: assessment.vision_score < 5 ? timeoutErrors : 0,
          },
          lowMotor: {
            semantic: assessment.motor_score < 5 ? semanticErrors : 0,
            phonemic: assessment.motor_score < 5 ? phonemicErrors : 0,
            timeout: assessment.motor_score < 5 ? timeoutErrors : 0,
          },
        };
      }

      // Add semantic vs phonemic insight
      const semanticCount = utterances.filter(u => u.error_type?.includes('semantic')).length;
      const phonemicCount = utterances.filter(u => u.error_type?.includes('phonemic')).length;
      if (semanticCount > phonemicCount * 2 && semanticCount > 5) {
        recommendations.push('Semantic exercises may help - word meaning connections are challenging');
      } else if (phonemicCount > semanticCount * 2 && phonemicCount > 5) {
        recommendations.push('Phonological exercises may help - sound patterns are challenging');
      }

      setAnalytics({
        attentionTimeoutCorrelation,
        visionAccuracyCorrelation,
        motorLatencyCorrelation,
        errorTypesByCapability,
        fatiguePattern,
        optimalConditions: {
          bestTimeOfDay: null, // Would need timestamp analysis
          bestSessionLength: fatiguePattern && fatiguePattern.dropoff > 0.15 ? 10 : 20,
          bestCueType,
        },
        recommendations,
      });
    } catch (err) {
      console.error('Error analyzing cross-domain correlations:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [userId, profileId, enabled]);

  useEffect(() => {
    analyze();
  }, [analyze]);

  return {
    analytics,
    isLoading,
    error,
    refresh: analyze,
  };
};
