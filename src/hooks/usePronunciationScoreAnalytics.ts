import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PhonemeStats {
  phoneme: string;
  avgAccuracy: number;
  sampleCount: number;
}

interface WordStats {
  word: string;
  avgScore: number;
  sampleCount: number;
  exampleAudioPath?: string;
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

        const { data, error: fetchError } = await supabase
          .from('utterance_analyses')
          .select('gop_data, target_word, created_at, audio_storage_path')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .not('gop_data', 'is', null)
          .order('created_at', { ascending: true });

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
  }, [userId, daysBack]);

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
    
    // Word aggregation with example audio (track min/max score examples)
    // Also track best available audio as fallback when min/max has no audio
    const wordMap = new Map<string, { 
      total: number; 
      count: number; 
      minScore: number;
      maxScore: number;
      minScoreAudioPath?: string;
      maxScoreAudioPath?: string;
      anyAudioPath?: string;  // Fallback: any sample with audio
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

      // Word-level scores with min/max score examples for better representation
      const targetWord = row.target_word?.toLowerCase();
      const score = gop.pronunciationScore;
      const hasAudio = !!row.audio_storage_path;
      
      if (targetWord && score) {
        const existing = wordMap.get(targetWord);
        if (!existing) {
          wordMap.set(targetWord, {
            total: score,
            count: 1,
            minScore: score,
            maxScore: score,
            // Only set audio path if audio exists
            minScoreAudioPath: hasAudio ? row.audio_storage_path! : undefined,
            maxScoreAudioPath: hasAudio ? row.audio_storage_path! : undefined,
            anyAudioPath: hasAudio ? row.audio_storage_path! : undefined
          });
        } else {
          const updated = {
            total: existing.total + score,
            count: existing.count + 1,
            minScore: existing.minScore,
            maxScore: existing.maxScore,
            minScoreAudioPath: existing.minScoreAudioPath,
            maxScoreAudioPath: existing.maxScoreAudioPath,
            anyAudioPath: existing.anyAudioPath || (hasAudio ? row.audio_storage_path! : undefined)
          };
          
          // Update min if this score is lower AND has audio (or if current min has no audio)
          if (score < existing.minScore) {
            updated.minScore = score;
            if (hasAudio) {
              updated.minScoreAudioPath = row.audio_storage_path!;
            }
          } else if (score === existing.minScore && hasAudio && !existing.minScoreAudioPath) {
            // Same score but this one has audio
            updated.minScoreAudioPath = row.audio_storage_path!;
          }
          
          // Update max if this score is higher AND has audio (or if current max has no audio)
          if (score > existing.maxScore) {
            updated.maxScore = score;
            if (hasAudio) {
              updated.maxScoreAudioPath = row.audio_storage_path!;
            }
          } else if (score === existing.maxScore && hasAudio && !existing.maxScoreAudioPath) {
            // Same score but this one has audio
            updated.maxScoreAudioPath = row.audio_storage_path!;
          }
          
          wordMap.set(targetWord, updated);
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

    // Convert word map to sorted array - use min score audio for practice, max for best
    const sortedWords = Array.from(wordMap.entries())
      .filter(([_, stats]) => stats.count >= 1)
      .sort((a, b) => a[1].total / a[1].count - b[1].total / b[1].count);

    // Words to practice: lowest scores, use minScoreAudioPath (worst example), fallback to any audio
    const needsPracticeWords: WordStats[] = sortedWords.slice(0, 5).map(([word, stats]) => ({
      word,
      avgScore: Math.round(stats.total / stats.count),
      sampleCount: stats.count,
      exampleAudioPath: stats.minScoreAudioPath || stats.anyAudioPath  // Prefer worst, fallback to any
    }));

    // Best words: highest scores, use maxScoreAudioPath (best example), fallback to any audio
    const bestWords: WordStats[] = sortedWords.slice(-5).reverse().map(([word, stats]) => ({
      word,
      avgScore: Math.round(stats.total / stats.count),
      sampleCount: stats.count,
      exampleAudioPath: stats.maxScoreAudioPath || stats.anyAudioPath  // Prefer best, fallback to any
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
