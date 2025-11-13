import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ParserAnalytics {
  totalCorrections: number;
  correctionsByField: Record<string, number>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  recentCorrections: Array<{
    field_name: string;
    original_value: any;
    corrected_value: any;
    created_at: string;
    confidence_before: string;
  }>;
  topCorrectedFields: Array<{
    field: string;
    count: number;
    percentage: number;
  }>;
}

export const useParserAnalytics = () => {
  const [analytics, setAnalytics] = useState<ParserAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all corrections
      const { data: corrections, error: correctionsError } = await supabase
        .from('clinical_profile_corrections')
        .select('*')
        .order('created_at', { ascending: false });

      if (correctionsError) throw correctionsError;

      if (!corrections || corrections.length === 0) {
        setAnalytics({
          totalCorrections: 0,
          correctionsByField: {},
          confidenceDistribution: { high: 0, medium: 0, low: 0 },
          recentCorrections: [],
          topCorrectedFields: []
        });
        setIsLoading(false);
        return;
      }

      // Calculate corrections by field
      const correctionsByField: Record<string, number> = {};
      const confidenceCounts = { high: 0, medium: 0, low: 0 };

      corrections.forEach(correction => {
        correctionsByField[correction.field_name] = 
          (correctionsByField[correction.field_name] || 0) + 1;
        
        if (correction.confidence_before) {
          const conf = correction.confidence_before.toLowerCase();
          if (conf in confidenceCounts) {
            confidenceCounts[conf as keyof typeof confidenceCounts]++;
          }
        }
      });

      // Calculate top corrected fields with percentages
      const totalCorrections = corrections.length;
      const topCorrectedFields = Object.entries(correctionsByField)
        .map(([field, count]) => ({
          field: field.replace(/^impairments\./, ''),
          count,
          percentage: Math.round((count / totalCorrections) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setAnalytics({
        totalCorrections,
        correctionsByField,
        confidenceDistribution: confidenceCounts,
        recentCorrections: corrections.slice(0, 20).map(c => ({
          field_name: c.field_name,
          original_value: c.original_value,
          corrected_value: c.corrected_value,
          created_at: c.created_at,
          confidence_before: c.confidence_before
        })),
        topCorrectedFields
      });
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { analytics, isLoading, error, refetch: fetchAnalytics };
};
