/**
 * Fetches curated audio samples for clinical review
 * Returns best and challenging examples with scores and timestamps
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AudioSample {
  id: string;
  targetWord: string;
  transcript: string | null;
  score: number;
  audioPath: string;
  timestamp: string;
  errorType: string | null;
}

interface CuratedSamples {
  challenging: AudioSample[];
  best: AudioSample[];
}

interface GopData {
  source?: string;
  pronunciationScore?: number;
}

export function useCuratedAudioSamples(userId: string | undefined, daysBack: number = 7) {
  const [samples, setSamples] = useState<CuratedSamples>({ challenging: [], best: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchSamples = async () => {
      setLoading(true);
      setError(null);

      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const { data, error: fetchError } = await supabase
          .from('utterance_analyses')
          .select('id, target_word, transcript, gop_data, audio_storage_path, created_at, error_type')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .not('audio_storage_path', 'is', null)
          .not('gop_data', 'is', null)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        // Filter to Azure data with valid scores
        const validSamples = (data || [])
          .filter(row => {
            const gop = row.gop_data as GopData | null;
            return gop?.source === 'azure' && 
                   typeof gop?.pronunciationScore === 'number' && 
                   gop.pronunciationScore > 0;
          })
          .map(row => ({
            id: row.id,
            targetWord: row.target_word,
            transcript: row.transcript,
            score: (row.gop_data as GopData).pronunciationScore!,
            audioPath: row.audio_storage_path!,
            timestamp: row.created_at,
            errorType: row.error_type
          }));

        // Sort by score
        const sorted = [...validSamples].sort((a, b) => a.score - b.score);

        // Get 3 lowest (challenging) and 3 highest (best)
        const challenging = sorted.slice(0, 3);
        const best = sorted.slice(-3).reverse();

        setSamples({ challenging, best });
      } catch (err) {
        console.error('[CuratedAudioSamples] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load audio samples');
      } finally {
        setLoading(false);
      }
    };

    fetchSamples();
  }, [userId, daysBack]);

  return { samples, loading, error };
}
