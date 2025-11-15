import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { BRAIN_REGIONS, getAffectedRegions } from '@/lib/brainRegionMapper';
import { useBrainRegionScores } from '@/hooks/useBrainRegionScores';
import { normalizeStrokeLocationArray } from '@/lib/strokeLocationMapper';
import { BrainRegionDetail } from './BrainRegionDetail';
import { InteractiveBrainMap, type RegionId } from './InteractiveBrainMap';

interface BrainMapProps {
  profile: { clinical_profile?: any };
  userId: string;
}

type MapMode = 'progress' | 'function' | 'injury';

export const BrainMap = ({ profile, userId }: BrainMapProps) => {
  const [mode, setMode] = useState<MapMode>('progress');
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>(null);
  const { scores, loading, error } = useBrainRegionScores(userId, profile);

  const normalized = normalizeStrokeLocationArray(profile?.clinical_profile?.stroke_location);
  const affectedRegions = getAffectedRegions(normalized.lesionZones);
  const affectedRegionIds = affectedRegions.map(r => r.id) as RegionId[];


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

        <InteractiveBrainMap
          mode={mode}
          scores={scores}
          affectedRegions={affectedRegionIds}
          selectedRegion={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
        />

        {selectedRegion && (
          selectedScore ? (
            <BrainRegionDetail region={selectedRegion} score={selectedScore} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{selectedRegion.displayName}</CardTitle>
                <CardDescription>
                  {selectedRegion.hemisphere === 'bilateral' ? 'Both hemispheres' : `${selectedRegion.hemisphere} hemisphere`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Not Enough Data Yet</p>
                    <p className="text-sm text-muted-foreground">
                      Complete more exercises that work with this brain region to see performance stats here.
                    </p>
                  </div>
                </div>
                
                {selectedRegion.functionalDomains.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Functions This Area Supports</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedRegion.functionalDomains.map((domain) => (
                        <Badge key={domain} variant="outline" className="capitalize">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRegion.exerciseSlugs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recommended Exercises</h4>
                    <p className="text-xs text-muted-foreground">
                      Try these exercises to build data for this region:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRegion.exerciseSlugs.map((slug) => (
                        <Badge key={slug} variant="secondary" className="text-xs">
                          {slug.replace(/-/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        )}
      </CardContent>
    </Card>
  );
};
