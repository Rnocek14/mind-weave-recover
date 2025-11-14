import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { BRAIN_REGIONS, getAffectedRegions } from '@/lib/brainRegionMapper';
import { useBrainRegionScores } from '@/hooks/useBrainRegionScores';
import { normalizeStrokeLocation } from '@/lib/strokeLocationMapper';
import { BrainRegionDetail } from './BrainRegionDetail';
import brainImage from '@/assets/brain-anatomy.png';

interface BrainMapProps {
  profile: { clinical_profile?: any };
  userId: string;
}

type MapMode = 'progress' | 'function' | 'injury';

export const BrainMap = ({ profile, userId }: BrainMapProps) => {
  const [mode, setMode] = useState<MapMode>('progress');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const { scores, loading, error } = useBrainRegionScores(userId, profile);

  const normalized = normalizeStrokeLocation(profile?.clinical_profile?.stroke_location);
  const affectedRegions = getAffectedRegions(normalized.lesionZones);
  const affectedRegionIds = new Set(affectedRegions.map(r => r.id));

  const getRegionColor = (regionId: string): string => {
    const score = scores[regionId];
    if (mode === 'injury') return affectedRegionIds.has(regionId) ? 'rgba(220, 38, 38, 0.5)' : 'transparent';
    if (mode === 'function') {
      if (!score || score.confidence === 'low') return 'rgba(156, 163, 175, 0.3)';
      if (score.currentScore >= 70) return 'rgba(34, 197, 94, 0.45)';
      if (score.currentScore >= 50) return 'rgba(234, 179, 8, 0.45)';
      if (score.currentScore >= 30) return 'rgba(249, 115, 22, 0.45)';
      return 'rgba(220, 38, 38, 0.5)';
    }
    if (!score || score.confidence === 'low') return 'transparent';
    if (score.trend === 'improving') return 'rgba(59, 130, 246, 0.45)';
    if (score.trend === 'declining') return 'rgba(249, 115, 22, 0.4)';
    return 'transparent';
  };

  if (loading) return <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5" />Unable to Load</CardTitle></CardHeader></Card>;

  const selectedRegion = selectedRegionId ? BRAIN_REGIONS.find(r => r.id === selectedRegionId) : null;
  const selectedScore = selectedRegionId ? scores[selectedRegionId] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brain Function Map</CardTitle>
        <CardDescription>Track recovery based on exercise performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={mode} onValueChange={(v) => setMode(v as MapMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">Recovery Progress</TabsTrigger>
            <TabsTrigger value="function">Current Function</TabsTrigger>
            <TabsTrigger value="injury">Affected Areas</TabsTrigger>
          </TabsList>
          <TabsContent value={mode} className="mt-4">
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {mode === 'progress' && 'Estimated trends based on exercise data, not brain scans.'}
                {mode === 'function' && 'Estimated function based on your exercise performance.'}
                {mode === 'injury' && 'Functions likely affected based on medical notes.'}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="relative w-full max-w-2xl mx-auto">
          <img src={brainImage} alt="Brain anatomy" className="w-full h-auto" />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 350">
            {BRAIN_REGIONS.map((region) => (
              <g key={region.id}>
                {region.svgPath && (
                  <path
                    d={region.svgPath}
                    fill={getRegionColor(region.id)}
                    opacity={selectedRegionId === region.id ? 0.85 : 0.6}
                    className="cursor-pointer transition-all hover:opacity-90"
                    onClick={() => setSelectedRegionId(region.id)}
                  />
                )}
                <text x={region.position?.x ?? 0} y={(region.position?.y ?? 0) - 10} className="text-xs fill-foreground font-medium pointer-events-none" textAnchor="middle">
                  {region.displayName}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {selectedRegion && selectedScore && <BrainRegionDetail region={selectedRegion} score={selectedScore} />}
      </CardContent>
    </Card>
  );
};
