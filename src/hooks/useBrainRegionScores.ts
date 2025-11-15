import { useState, useEffect } from 'react';
import { BRAIN_REGIONS, getAffectedRegions } from '@/lib/brainRegionMapper';
import { calculateRegionScore, RegionFunctionalScore } from '@/lib/functionalScoreCalculator';
import { normalizeStrokeLocationArray } from '@/lib/strokeLocationMapper';

export const useBrainRegionScores = (userId: string | undefined, profile: any) => {
  const [scores, setScores] = useState<Record<string, RegionFunctionalScore>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScores = async () => {
      if (!userId || !profile?.clinical_profile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get affected regions based on stroke location
        const normalized = normalizeStrokeLocationArray(
          profile.clinical_profile?.stroke_location || null
        );
        const affectedRegions = getAffectedRegions(normalized.lesionZones);

        // If no specific regions affected, analyze all regions
        const regionsToAnalyze = affectedRegions.length > 0 ? affectedRegions : BRAIN_REGIONS;

        // Calculate scores for all regions in parallel
        const scorePromises = regionsToAnalyze.map(region =>
          calculateRegionScore(region, profile, userId)
        );

        const regionScores = await Promise.all(scorePromises);

        // Convert to dictionary
        const scoresDict = regionScores.reduce((acc, score) => {
          acc[score.regionId] = score;
          return acc;
        }, {} as Record<string, RegionFunctionalScore>);

        setScores(scoresDict);
      } catch (e) {
        console.error('Error calculating brain region scores:', e);
        setError(e instanceof Error ? e.message : 'Failed to calculate scores');
      } finally {
        setLoading(false);
      }
    };

    void fetchScores();
  }, [userId, profile]);

  return { scores, loading, error };
};
