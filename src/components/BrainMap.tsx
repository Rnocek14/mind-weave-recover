import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { BRAIN_REGIONS, getAffectedRegions } from '@/lib/brainRegionMapper';
import { normalizeStrokeLocation } from '@/lib/strokeLocationMapper';
import { useBrainRegionScores } from '@/hooks/useBrainRegionScores';
import { BrainRegionDetail } from './BrainRegionDetail';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BrainMapProps {
  profile: any;
  userId: string;
}

type MapMode = 'injury' | 'function' | 'progress';

export const BrainMap = ({ profile, userId }: BrainMapProps) => {
  const [mode, setMode] = useState<MapMode>('function');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const { scores, loading } = useBrainRegionScores(userId, profile);

  const normalized = normalizeStrokeLocation(profile?.clinical_profile?.stroke_location || null);
  const affectedRegions = getAffectedRegions(normalized.lesionZones);
  const affectedRegionIds = new Set(affectedRegions.map(r => r.id));

  const getRegionColor = (regionId: string): string => {
    const score = scores[regionId];
    
    if (mode === 'injury') {
      return affectedRegionIds.has(regionId) ? 'hsl(0 84% 60%)' : 'hsl(var(--muted))';
    }
    
    if (!score || score.contributingMetrics.trialCount < 10) {
      return 'hsl(var(--muted))';
    }
    
    if (mode === 'function') {
      // Red to Green based on current score
      if (score.currentScore >= 70) return 'hsl(142 76% 36%)'; // Green
      if (score.currentScore >= 50) return 'hsl(48 96% 53%)'; // Yellow
      if (score.currentScore >= 30) return 'hsl(25 95% 53%)'; // Orange
      return 'hsl(0 84% 60%)'; // Red
    }
    
    if (mode === 'progress') {
      // Blue = improving, Gray = stable, Orange = declining
      if (score.trend === 'improving') return 'hsl(217 91% 60%)'; // Blue
      if (score.trend === 'declining') return 'hsl(25 95% 53%)'; // Orange
      return 'hsl(var(--muted))'; // Gray
    }
    
    return 'hsl(var(--muted))';
  };

  const getRegionOpacity = (regionId: string): number => {
    const score = scores[regionId];
    
    if (mode === 'injury') {
      return affectedRegionIds.has(regionId) ? 0.8 : 0.2;
    }
    
    if (!score || score.contributingMetrics.trialCount < 10) {
      return 0.2;
    }
    
    return 0.7;
  };

  const selectedRegion = selectedRegionId 
    ? BRAIN_REGIONS.find(r => r.id === selectedRegionId) 
    : null;
  const selectedScore = selectedRegionId ? scores[selectedRegionId] : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Brain & Recovery Map</CardTitle>
              <CardDescription className="mt-1">
                Functional progress based on your exercises and assessments
              </CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    This map shows which brain functions were affected by your stroke and how
                    they're improving based on your exercise performance. Colors update as your
                    scores change—not a live brain scan.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as MapMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="injury">Injury Map</TabsTrigger>
              <TabsTrigger value="function">Current Function</TabsTrigger>
              <TabsTrigger value="progress">Recovery Progress</TabsTrigger>
            </TabsList>
            
            <TabsContent value={mode} className="space-y-4">
              {/* Legend */}
              <div className="flex items-center gap-4 text-sm flex-wrap">
                {mode === 'injury' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0 84% 60%)' }} />
                      <span>Affected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-muted" />
                      <span>Unaffected</span>
                    </div>
                  </>
                )}
                {mode === 'function' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0 84% 60%)' }} />
                      <span>Severely impaired</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(25 95% 53%)' }} />
                      <span>Moderate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(48 96% 53%)' }} />
                      <span>Mild</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
                      <span>Good function</span>
                    </div>
                  </>
                )}
                {mode === 'progress' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(217 91% 60%)' }} />
                      <span>Improving</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-muted" />
                      <span>Stable</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(25 95% 53%)' }} />
                      <span>Declining</span>
                    </div>
                  </>
                )}
              </div>

              {/* Brain Visualization */}
              <div className="relative w-full aspect-[2/1] bg-muted/30 rounded-lg overflow-hidden">
                <svg viewBox="0 0 800 400" className="w-full h-full">
                  {/* Brain outline */}
                  <ellipse
                    cx="250"
                    cy="180"
                    rx="150"
                    ry="120"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <ellipse
                    cx="550"
                    cy="180"
                    rx="150"
                    ry="120"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  
                  {/* Regions */}
                  {BRAIN_REGIONS.map((region) => {
                    const color = getRegionColor(region.id);
                    const opacity = getRegionOpacity(region.id);
                    const isSelected = selectedRegionId === region.id;
                    
                    return (
                      <g key={region.id}>
                        <circle
                          cx={region.position?.x}
                          cy={region.position?.y}
                          r={isSelected ? 45 : 40}
                          fill={color}
                          opacity={opacity}
                          stroke={isSelected ? 'currentColor' : 'none'}
                          strokeWidth={isSelected ? 3 : 0}
                          className="cursor-pointer transition-all hover:opacity-100"
                          onClick={() => setSelectedRegionId(region.id)}
                        />
                        <text
                          x={region.position?.x}
                          y={region.position?.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-xs font-medium pointer-events-none"
                          fill="currentColor"
                        >
                          {region.displayName.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Labels */}
                  <text x="250" y="330" textAnchor="middle" className="text-sm font-medium" fill="currentColor">
                    Left Hemisphere
                  </text>
                  <text x="550" y="330" textAnchor="middle" className="text-sm font-medium" fill="currentColor">
                    Right Hemisphere
                  </text>
                </svg>
              </div>

              {/* Instructions */}
              <div className="text-sm text-muted-foreground text-center">
                Click on a brain region to see detailed information
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Selected Region Detail */}
      {selectedRegion && selectedScore && (
        <BrainRegionDetail region={selectedRegion} score={selectedScore} />
      )}
    </div>
  );
};
