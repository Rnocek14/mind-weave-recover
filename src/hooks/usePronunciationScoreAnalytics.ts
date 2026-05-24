import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

interface PhonemeStats {
  phoneme: string;
  avgAccuracy: number;
  sampleCount: number;
}

interface WordExample {
  score: number;
  audioPath: string;
  timestamp: string;
}

interface WordStats {
  word: string;
  avgScore: number;
  sampleCount: number;
  exampleAudioPath?: string;
  examples: WordExample[];  // Up to 3 examples with audio
}

interface DailyTrend {
  date: string;
  avgScore: number;
  count: number;
}

export interface PronunciationScoreAnalytics {
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number;
  sampleCount: number;
  hardestPhonemes: PhonemeStats[];
  strongestPhonemes: PhonemeStats[];
  needsPracticeWords: WordStats[];
  bestWords: WordStats[];
  weeklyTrend: DailyTrend[];
  weekOverWeekChange: number | null;
}

interface GopData {
  source?: string;
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  words?: Array<{
    word?: string;
    accuracyScore?: number;
    phonemes?: Array<{
      phoneme?: string;
      accuracyScore?: number;
    }>;
  }>;
}

export function usePronunciationScoreAnalytics(userId: string | undefined, daysBack: number = 7) {
  const activeProfileId = useActiveProfileId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<Array<{
    gop_data: GopData | null;
    target_word: string;
    created_at: string;
    audio_storage_path: string | null;
  }>>([]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        let q = supabase
          .from('utterance_analyses')
          .select('gop_data, target_word, created_at, audio_storage_path')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .not('gop_data', 'is', null)
          .order('created_at', { ascending: true });
        if (activeProfileId) q = q.eq('profile_id', activeProfileId);
        const { data, error: fetchError } = await q;

        if (fetchError) throw fetchError;

        // Filter to only Azure data with valid pronunciation scores
        const azureData = (data || []).filter(row => {
          const gop = row.gop_data as GopData | null;
          return gop?.source === 'azure' && 
                 typeof gop?.pronunciationScore === 'number' && 
                 gop.pronunciationScore > 0;
        });

        setRawData(azureData.map(row => ({
          gop_data: row.gop_data as GopData,
          target_word: row.target_word,
          created_at: row.created_at,
          audio_storage_path: row.audio_storage_path
        })));
      } catch (err) {
        console.error('[PronunciationAnalytics] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pronunciation data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, daysBack, activeProfileId]);

  const analytics = useMemo<PronunciationScoreAnalytics | null>(() => {
    if (rawData.length === 0) return null;

    // Aggregate overall scores
    let totalPronunciation = 0;
    let totalAccuracy = 0;
    let totalFluency = 0;
    let totalCompleteness = 0;
    let totalProsody = 0;
    let prosodyCount = 0;

    // Phoneme aggregation
    const phonemeMap = new Map<string, { total: number; count: number }>();
    
    // Word aggregation with multiple audio examples (up to 3 per word)
    const wordMap = new Map<string, { 
      total: number; 
      count: number; 
      examples: Array<{ score: number; audioPath: string; timestamp: string }>;
    }>();

    // Daily aggregation for trends
    const dailyMap = new Map<string, { total: number; count: number }>();

    rawData.forEach(row => {
      const gop = row.gop_data;
      if (!gop) return;

      // Overall scores
      totalPronunciation += gop.pronunciationScore ?? 0;
      totalAccuracy += gop.accuracyScore ?? 0;
      totalFluency += gop.fluencyScore ?? 0;
      totalCompleteness += gop.completenessScore ?? 0;
      if (typeof gop.prosodyScore === 'number' && gop.prosodyScore > 0) {
        totalProsody += gop.prosodyScore;
        prosodyCount++;
      }

      // Word-level scores with multiple audio examples
      const targetWord = row.target_word?.toLowerCase();
      const score = gop.pronunciationScore;
      const hasAudio = !!row.audio_storage_path;
      
      if (targetWord && score) {
        const existing = wordMap.get(targetWord);
        const newExample = hasAudio ? { 
          score, 
          audioPath: row.audio_storage_path!, 
          timestamp: row.created_at 
        } : null;
        
        if (!existing) {
          wordMap.set(targetWord, {
            total: score,
            count: 1,
            examples: newExample ? [newExample] : []
          });
        } else {
          // Add to examples array (keep up to 3 most recent with audio)
          const updatedExamples = [...existing.examples];
          if (newExample) {
            updatedExamples.push(newExample);
            // Sort by score to get variety, keep up to 3
            updatedExamples.sort((a, b) => a.score - b.score);
            if (updatedExamples.length > 3) {
              // Keep lowest, middle, and highest for variety
              const lowest = updatedExamples[0];
              const highest = updatedExamples[updatedExamples.length - 1];
              const middle = updatedExamples[Math.floor(updatedExamples.length / 2)];
              updatedExamples.length = 0;
              updatedExamples.push(lowest, middle, highest);
            }
          }
          
          wordMap.set(targetWord, {
            total: existing.total + score,
            count: existing.count + 1,
            examples: updatedExamples
          });
        }
      }

      // Phoneme-level scores
      if (gop.words && Array.isArray(gop.words)) {
        gop.words.forEach(word => {
          if (word.phonemes && Array.isArray(word.phonemes)) {
            word.phonemes.forEach(phoneme => {
              if (phoneme.phoneme && typeof phoneme.accuracyScore === 'number') {
                const key = phoneme.phoneme.toLowerCase();
                const existing = phonemeMap.get(key) || { total: 0, count: 0 };
                phonemeMap.set(key, {
                  total: existing.total + phoneme.accuracyScore,
                  count: existing.count + 1
                });
              }
            });
          }
        });
      }

      // Daily trends
      const dateKey = row.created_at.split('T')[0];
      const dayData = dailyMap.get(dateKey) || { total: 0, count: 0 };
      dailyMap.set(dateKey, {
        total: dayData.total + (gop.pronunciationScore ?? 0),
        count: dayData.count + 1
      });
    });

    const count = rawData.length;

    // Convert phoneme map to sorted array
    const phonemeStats: PhonemeStats[] = Array.from(phonemeMap.entries())
      .filter(([_, stats]) => stats.count >= 2) // Minimum 2 samples
      .map(([phoneme, stats]) => ({
        phoneme,
        avgAccuracy: Math.round(stats.total / stats.count),
        sampleCount: stats.count
      }))
      .sort((a, b) => a.avgAccuracy - b.avgAccuracy);

    // Convert word map to sorted array
    const sortedWords = Array.from(wordMap.entries())
      .filter(([_, stats]) => stats.count >= 1)
      .sort((a, b) => a[1].total / a[1].count - b[1].total / b[1].count);

    // Words to practice: lowest avg scores
    const needsPracticeWords: WordStats[] = sortedWords.slice(0, 5).map(([word, stats]) => ({
      word,
      avgScore: Math.round(stats.total / stats.count),
      sampleCount: stats.count,
      exampleAudioPath: stats.examples[0]?.audioPath,  // First (lowest score) example
      examples: stats.examples
    }));

    // Best words: highest avg scores
    const bestWords: WordStats[] = sortedWords.slice(-5).reverse().map(([word, stats]) => ({
      word,
      avgScore: Math.round(stats.total / stats.count),
      sampleCount: stats.count,
      exampleAudioPath: stats.examples[stats.examples.length - 1]?.audioPath,  // Last (highest score) example
      examples: stats.examples
    }));

    // Convert daily map to trend array
    const weeklyTrend: DailyTrend[] = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        avgScore: Math.round(stats.total / stats.count),
        count: stats.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate week-over-week change
    let weekOverWeekChange: number | null = null;
    if (weeklyTrend.length >= 2) {
      const firstHalf = weeklyTrend.slice(0, Math.floor(weeklyTrend.length / 2));
      const secondHalf = weeklyTrend.slice(Math.floor(weeklyTrend.length / 2));
      
      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.avgScore, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.avgScore, 0) / secondHalf.length;
        weekOverWeekChange = Math.round(secondAvg - firstAvg);
      }
    }

    return {
      overallScore: Math.round(totalPronunciation / count),
      accuracyScore: Math.round(totalAccuracy / count),
      fluencyScore: Math.round(totalFluency / count),
      completenessScore: Math.round(totalCompleteness / count),
      prosodyScore: prosodyCount > 0 ? Math.round(totalProsody / prosodyCount) : 0,
      sampleCount: count,
      hardestPhonemes: phonemeStats.slice(0, 5),
      strongestPhonemes: phonemeStats.slice(-5).reverse(),
      needsPracticeWords,
      bestWords,
      weeklyTrend,
      weekOverWeekChange
    };
  }, [rawData]);

  return { analytics, loading, error };
}
