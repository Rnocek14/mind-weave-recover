import React, { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BRAIN_REGIONS } from '@/lib/brainRegionMapper';
import { Badge } from '@/components/ui/badge';

type MapMode = "injury" | "function" | "progress";

export type RegionId =
  | "frontal_lobe"
  | "motor_cortex"
  | "somatosensory_cortex"
  | "parietal_lobe"
  | "temporal_lobe"
  | "occipital_lobe"
  | "cerebellum"
  | "brainstem"
  | "language_areas"
  | "subcortical";

export interface RegionScore {
  currentScore: number;
  trend: "improving" | "stable" | "declining";
  trialCount: number;
  confidence: "high" | "medium" | "low";
}

export interface InteractiveBrainMapProps {
  mode: MapMode;
  scores: Partial<Record<RegionId, RegionScore>>;
  affectedRegions?: RegionId[];
  affectedTerritories?: string[];
  selectedRegion?: RegionId | null;
  onSelectRegion?: (region: RegionId) => void;
}

// Anatomically-informed lateral brain SVG paths (left hemisphere view)
const REGION_PATHS: Record<RegionId, { d: string; label: string; labelPos: { x: number; y: number }; labelAnchor?: string }> = {
  frontal_lobe: {
    d: "M 52,155 C 48,130 50,100 58,78 C 68,55 85,40 110,32 C 135,25 165,24 195,28 C 220,32 240,42 252,58 L 248,68 C 242,88 238,110 236,132 C 234,150 230,165 222,175 C 210,188 190,195 168,198 C 140,200 110,195 85,185 C 65,177 55,168 52,155 Z",
    label: "Frontal",
    labelPos: { x: 148, y: 115 },
  },
  motor_cortex: {
    d: "M 252,58 C 260,48 270,44 280,46 C 290,50 296,62 298,78 C 300,95 298,115 294,132 C 290,148 284,160 276,168 C 268,162 260,152 255,140 C 248,122 244,100 248,78 L 248,68 Z",
    label: "Motor",
    labelPos: { x: 272, y: 100 },
  },
  somatosensory_cortex: {
    d: "M 280,46 C 292,44 304,50 314,62 C 322,74 328,90 330,108 C 332,126 328,144 320,158 C 312,168 302,174 292,172 C 284,168 278,160 276,168 C 284,160 290,148 294,132 C 298,115 300,95 298,78 C 296,62 290,50 280,46 Z",
    label: "Sensory",
    labelPos: { x: 308, y: 108 },
  },
  parietal_lobe: {
    d: "M 314,62 C 330,68 345,82 358,100 C 372,120 380,145 382,170 C 383,192 378,212 368,228 C 355,242 338,248 318,245 C 298,242 282,232 270,218 C 262,205 258,190 260,172 C 264,150 275,125 292,172 C 302,174 312,168 320,158 C 328,144 332,126 330,108 C 328,90 322,74 314,62 Z",
    label: "Parietal",
    labelPos: { x: 340, y: 165 },
  },
  temporal_lobe: {
    d: "M 52,155 C 55,168 65,177 85,185 C 110,195 140,200 168,198 C 190,195 210,188 222,175 C 232,192 238,210 236,228 C 234,248 222,262 205,272 C 185,282 160,286 135,284 C 110,282 88,272 72,258 C 58,245 50,228 48,210 C 46,192 48,175 52,155 Z",
    label: "Temporal",
    labelPos: { x: 138, y: 242 },
  },
  language_areas: {
    d: "M 168,198 C 182,200 194,208 200,220 C 206,232 206,248 200,260 C 194,270 183,276 172,274 C 162,272 154,264 150,252 C 146,240 148,225 155,214 C 160,206 164,200 168,198 Z",
    label: "Language",
    labelPos: { x: 176, y: 238 },
  },
  occipital_lobe: {
    d: "M 382,170 C 400,172 418,180 432,195 C 445,210 452,232 450,255 C 448,275 438,292 422,302 C 405,310 384,312 365,305 C 350,298 340,285 338,268 C 336,250 342,230 355,212 C 362,202 370,188 382,170 Z",
    label: "Occipital",
    labelPos: { x: 400, y: 248 },
  },
  cerebellum: {
    d: "M 338,268 C 340,285 350,298 365,305 C 355,318 342,328 325,332 C 305,336 285,332 270,322 C 258,312 252,298 254,282 C 258,268 268,258 282,252 C 298,248 316,250 330,258 C 334,260 336,264 338,268 Z",
    label: "Cerebellum",
    labelPos: { x: 305, y: 295 },
  },
  brainstem: {
    d: "M 254,282 C 252,298 248,312 240,324 C 234,334 226,340 218,338 C 212,336 208,328 206,318 C 204,308 206,296 212,286 C 218,278 228,272 240,270 C 248,268 252,272 254,282 Z",
    label: "Brainstem",
    labelPos: { x: 230, y: 308 },
  },
  subcortical: {
    d: "M 222,175 C 234,178 244,186 250,198 C 256,212 254,228 246,240 C 238,250 226,256 214,254 C 204,252 196,244 192,232 C 188,220 190,206 198,196 C 206,186 214,180 222,175 Z",
    label: "Deep",
    labelPos: { x: 222, y: 218 },
  },
};

// Color schemes using HSL values from design system
function getRegionFill(
  mode: MapMode,
  regionId: RegionId,
  scores: InteractiveBrainMapProps["scores"],
  affectedRegions?: RegionId[]
): { fill: string; stroke: string; opacity: number } {
  const score = scores[regionId];
  const isAffected = affectedRegions?.includes(regionId);

  if (mode === "injury") {
    if (isAffected) {
      return { fill: "hsl(0 84% 60%)", stroke: "hsl(0 84% 45%)", opacity: 0.7 };
    }
    return { fill: "hsl(210 40% 96%)", stroke: "hsl(210 30% 82%)", opacity: 0.5 };
  }

  if (!score || score.trialCount < 10) {
    return { fill: "hsl(210 40% 92%)", stroke: "hsl(210 30% 82%)", opacity: 0.6 };
  }

  if (mode === "function") {
    if (score.currentScore >= 70) return { fill: "hsl(142 76% 46%)", stroke: "hsl(142 76% 36%)", opacity: 0.65 };
    if (score.currentScore >= 50) return { fill: "hsl(38 92% 55%)", stroke: "hsl(38 92% 42%)", opacity: 0.65 };
    if (score.currentScore >= 30) return { fill: "hsl(25 95% 55%)", stroke: "hsl(25 95% 42%)", opacity: 0.65 };
    return { fill: "hsl(0 84% 55%)", stroke: "hsl(0 84% 42%)", opacity: 0.7 };
  }

  // Progress mode
  if (score.trend === "improving") return { fill: "hsl(205 85% 55%)", stroke: "hsl(205 85% 40%)", opacity: 0.65 };
  if (score.trend === "declining") return { fill: "hsl(25 95% 55%)", stroke: "hsl(25 95% 42%)", opacity: 0.65 };
  return { fill: "hsl(210 40% 88%)", stroke: "hsl(210 30% 75%)", opacity: 0.55 };
}

// Legend items per mode
const LEGENDS: Record<MapMode, { color: string; label: string }[]> = {
  injury: [
    { color: "hsl(0 84% 60%)", label: "Affected" },
    { color: "hsl(210 40% 92%)", label: "Unaffected" },
  ],
  function: [
    { color: "hsl(142 76% 46%)", label: "Strong (70%+)" },
    { color: "hsl(38 92% 55%)", label: "Moderate (50–70%)" },
    { color: "hsl(25 95% 55%)", label: "Weak (30–50%)" },
    { color: "hsl(0 84% 55%)", label: "Impaired (<30%)" },
    { color: "hsl(210 40% 92%)", label: "No data" },
  ],
  progress: [
    { color: "hsl(205 85% 55%)", label: "Improving" },
    { color: "hsl(210 40% 88%)", label: "Stable" },
    { color: "hsl(25 95% 55%)", label: "Declining" },
    { color: "hsl(210 40% 92%)", label: "No data" },
  ],
};

export const InteractiveBrainMap: React.FC<InteractiveBrainMapProps> = ({
  mode,
  scores,
  affectedRegions,
  selectedRegion,
  onSelectRegion,
}) => {
  const regionIds = Object.keys(REGION_PATHS) as RegionId[];
  const legend = LEGENDS[mode];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full max-w-2xl mx-auto space-y-3">
        {/* SVG Brain */}
        <div className="relative rounded-2xl bg-card border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <svg
            viewBox="0 0 500 365"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto"
            role="img"
            aria-label="Interactive brain map showing functional regions"
          >
            <defs>
              {/* Subtle gradient for background */}
              {/* Background uses CSS variables for dark mode support */}
              {/* Glow filter for selected region */}
              <filter id="region-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Subtle inner shadow for depth */}
              <filter id="inner-depth" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                <feOffset dx="1" dy="2" result="offsetBlur" />
                <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="innerShadow" />
                <feFlood floodColor="hsl(215 25% 20%)" floodOpacity="0.12" result="color" />
                <feComposite in="color" in2="innerShadow" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="shadow" />
                </feMerge>
              </filter>
              {/* Pulse animation for affected regions */}
              <filter id="pulse-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background - inherits from parent bg-card */}
            <rect x="0" y="0" width="500" height="365" className="fill-card" rx="16" />

            {/* Brain outline silhouette for context */}
            <path
              d="M 48,155 C 44,125 48,90 58,65 C 72,38 98,22 130,18 C 165,14 200,16 230,24 C 255,32 275,42 290,46 C 310,42 330,52 348,72 C 370,95 388,128 398,165 C 412,170 430,185 442,205 C 455,228 458,258 452,280 C 446,300 432,315 412,322 C 395,328 375,328 358,318 C 348,332 332,342 312,346 C 288,350 264,344 248,330 C 236,342 220,348 202,344 C 186,340 174,328 168,312 C 152,318 132,316 116,306 C 98,295 82,278 70,258 C 56,238 46,215 44,192 C 42,178 44,165 48,155 Z"
              fill="none"
              className="stroke-border"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              opacity="0.5"
            />

            {/* Region paths */}
            {regionIds.map((regionId) => {
              const region = REGION_PATHS[regionId];
              const { fill, stroke, opacity } = getRegionFill(mode, regionId, scores, affectedRegions);
              const isSelected = selectedRegion === regionId;
              const score = scores[regionId];
              const isAffected = affectedRegions?.includes(regionId);
              const brainRegion = BRAIN_REGIONS.find(r => r.id === regionId);

              return (
                <Tooltip key={regionId}>
                  <TooltipTrigger asChild>
                    <g
                      className="cursor-pointer"
                      onClick={() => onSelectRegion?.(regionId)}
                      style={{ transition: 'var(--transition-smooth)' }}
                    >
                      {/* Region fill */}
                      <path
                        d={region.d}
                        fill={fill}
                        fillOpacity={opacity}
                        stroke={isSelected ? "hsl(var(--primary))" : stroke}
                        strokeWidth={isSelected ? 2.5 : 1.2}
                        filter={isSelected ? "url(#region-glow)" : "url(#inner-depth)"}
                        className="transition-all duration-300 ease-out"
                        style={{
                          cursor: 'pointer',
                        }}
                      />
                      {/* Hover highlight overlay */}
                      <path
                        d={region.d}
                        fill="white"
                        fillOpacity="0"
                        className="transition-all duration-200 hover:fill-opacity-[0.15]"
                        style={{ cursor: 'pointer' }}
                      />
                      {/* Region label */}
                      <text
                        x={region.labelPos.x}
                        y={region.labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="pointer-events-none select-none"
                        style={{
                          fontSize: regionId === 'cerebellum' || regionId === 'brainstem' ? '8px' : '9px',
                          fontWeight: 600,
                          fill: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                          letterSpacing: '0.02em',
                          textShadow: '0 1px 2px hsl(var(--card) / 0.8)',
                        }}
                      >
                        {region.label}
                      </text>
                      {/* Score badge for regions with data */}
                      {score && score.trialCount >= 10 && mode !== 'injury' && (
                        <>
                          <circle
                            cx={region.labelPos.x}
                            cy={region.labelPos.y + 14}
                            r="10"
                            fill="hsl(var(--card))"
                            stroke={stroke}
                            strokeWidth="1"
                            opacity="0.95"
                          />
                          <text
                            x={region.labelPos.x}
                            y={region.labelPos.y + 14.5}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="pointer-events-none select-none"
                            style={{
                              fontSize: '7px',
                              fontWeight: 700,
                              fill: 'hsl(var(--foreground))',
                            }}
                          >
                            {Math.round(score.currentScore)}%
                          </text>
                        </>
                      )}
                      {/* Affected indicator in injury mode */}
                      {mode === 'injury' && isAffected && (
                        <circle
                          cx={region.labelPos.x + 18}
                          cy={region.labelPos.y - 10}
                          r="4"
                          fill="hsl(0 84% 55%)"
                          stroke="hsl(var(--card))"
                          strokeWidth="1.5"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-popover text-popover-foreground border-border max-w-[200px]">
                    <div className="text-xs space-y-1.5">
                      <p className="font-semibold text-sm">{brainRegion?.displayName || region.label}</p>
                      {brainRegion && (
                        <div className="flex flex-wrap gap-1">
                          {brainRegion.functionalDomains.map(d => (
                            <span key={d} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] capitalize">{d}</span>
                          ))}
                        </div>
                      )}
                      {score && score.trialCount >= 10 ? (
                        <div className="space-y-0.5 pt-1 border-t border-border">
                          <p>Function: <span className="font-semibold">{Math.round(score.currentScore)}%</span></p>
                          <p className="capitalize">Trend: {score.trend}</p>
                          <p>{score.trialCount} trials</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          {score && score.trialCount > 0
                            ? `${score.trialCount} trials (need 10+)`
                            : 'No exercise data yet'}
                        </p>
                      )}
                      {isAffected && (
                        <p className="text-destructive font-medium">⚠ Affected by stroke</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm border border-border inline-block"
                style={{ backgroundColor: item.color, opacity: 0.75 }}
              />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
