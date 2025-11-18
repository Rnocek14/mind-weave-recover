import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CapabilityProgressionPoint {
  date: string;
  visionScore: number;
  motorScore: number;
  attentionScore: number;
  confidence: number;
}

export const useCapabilityProgression = (userId: string | undefined) => {
  const [progression, setProgression] = useState<CapabilityProgressionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchProgression = async () => {
      setLoading(true);
      try {
        // Type workaround until types are regenerated after migration
        const { data, error } = await (supabase as any)
          .from('capability_assessments')
          .select('assessed_at, vision_score, motor_score, attention_score, confidence_score, completed')
          .eq('user_id', userId)
          .eq('completed', true)
          .order('assessed_at', { ascending: true });

        if (error) throw error;

        const progressionData: CapabilityProgressionPoint[] = (data || []).map(assessment => ({
          date: new Date(assessment.assessed_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          visionScore: assessment.vision_score || 0,
          motorScore: assessment.motor_score || 0,
          attentionScore: assessment.attention_score || 0,
          confidence: assessment.confidence_score || 0,
        }));

        setProgression(progressionData);
      } catch (error) {
        console.error('Error fetching capability progression:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgression();
  }, [userId]);

  const getTrend = (capability: 'vision' | 'motor' | 'attention'): 'up' | 'down' | 'stable' => {
    if (progression.length < 2) return 'stable';

    const key = `${capability}Score` as keyof CapabilityProgressionPoint;
    const recent = progression[progression.length - 1][key] as number;
    const previous = progression[progression.length - 2][key] as number;

    if (recent > previous + 1) return 'up';
    if (recent < previous - 1) return 'down';
    return 'stable';
  };

  return {
    progression,
    loading,
    getTrend,
    hasMultipleAssessments: progression.length > 1,
  };
};
