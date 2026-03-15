import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BRAIN_REGIONS } from '@/lib/brainRegionMapper';

type MapMode = "injury" | "function" | "progress";

const MODE_LABELS: Record<MapMode, { title: string; description: string }> = {
  progress: { title: "Recovery Trend", description: "Tracking change over time based on exercise data" },
  function: { title: "Functional Performance", description: "Current estimated function by region" },
  injury: { title: "Stroke Injury Map", description: "Regions likely affected based on clinical data" },
};

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

// Primary anatomical regions always show labels
// Functional overlays (motor, sensory, language, subcortical) show labels only on hover/selection
const PRIMARY_REGIONS: RegionId[] = ['frontal_lobe', 'parietal_lobe', 'temporal_lobe', 'occipital_lobe', 'cerebellum', 'brainstem'];
const OVERLAY_REGIONS: RegionId[] = ['motor_cortex', 'somatosensory_cortex', 'language_areas', 'subcortical'];

// Clinically-informed lateral brain SVG paths
const REGION_PATHS: Record<RegionId, { d: string; label: string; labelPos: { x: number; y: number } }> = {
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
    labelPos: { x: 230, y: 305 },
  },
  subcortical: {
    d: "M 222,175 C 234,178 244,186 250,198 C 256,212 254,228 246,240 C 238,250 226,256 214,254 C 204,252 196,244 192,232 C 188,220 190,206 198,196 C 206,186 214,180 222,175 Z",
    label: "Deep",
    labelPos: { x: 222, y: 218 },
  },
};

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
      return { fill: "hsl(0 84% 60%)", stroke: "hsl(0 72% 42%)", opacity: 0.75 };
    }
    return { fill: "hsl(var(--muted))", stroke: "hsl(var(--border))", opacity: 0.4 };
  }

  // No data — use a distinct dashed-pattern look (handled via stroke style below)
  if (!score || score.trialCount < 10) {
    return { fill: "hsl(var(--muted))", stroke: "hsl(var(--border))", opacity: 0.35 };
  }

  if (mode === "function") {
    if (score.currentScore >= 70) return { fill: "hsl(var(--success))", stroke: "hsl(142 76% 30%)", opacity: 0.7 };
    if (score.currentScore >= 50) return { fill: "hsl(var(--warning))", stroke: "hsl(38 92% 38%)", opacity: 0.7 };
    if (score.currentScore >= 30) return { fill: "hsl(25 95% 53%)", stroke: "hsl(25 95% 38%)", opacity: 0.7 };
    return { fill: "hsl(var(--destructive))", stroke: "hsl(0 84% 42%)", opacity: 0.75 };
  }

  // Progress mode — stronger contrast between states
  if (score.trend === "improving") return { fill: "hsl(var(--primary))", stroke: "hsl(205 85% 35%)", opacity: 0.7 };
  if (score.trend === "declining") return { fill: "hsl(25 95% 53%)", stroke: "hsl(25 95% 38%)", opacity: 0.7 };
  // Stable — slightly more visible than no-data
  return { fill: "hsl(var(--muted))", stroke: "hsl(var(--border))", opacity: 0.55 };
}

const LEGENDS: Record<MapMode, { color: string; label: string; className?: string }[]> = {
  injury: [
    { color: "hsl(0 84% 60%)", label: "Affected" },
    { color: "transparent", label: "Unaffected", className: "border-dashed border-muted-foreground/40" },
  ],
  function: [
    { color: "hsl(var(--success))", label: "Strong (70%+)" },
    { color: "hsl(var(--warning))", label: "Moderate (50–70%)" },
    { color: "hsl(25 95% 53%)", label: "Reduced (30–50%)" },
    { color: "hsl(var(--destructive))", label: "Impaired (<30%)" },
    { color: "transparent", label: "No data", className: "border-dashed border-muted-foreground/40" },
  ],
  progress: [
    { color: "hsl(var(--primary))", label: "Improving" },
    { color: "hsl(var(--muted))", label: "Stable" },
    { color: "hsl(25 95% 53%)", label: "Declining" },
    { color: "transparent", label: "No data", className: "border-dashed border-muted-foreground/40" },
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
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div>
              <p className="text-xs font-medium text-foreground">{MODE_LABELS[mode].title}</p>
              <p className="text-[10px] text-muted-foreground">{MODE_LABELS[mode].description}</p>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Tap a region for details</p>
          </div>
          <svg
            viewBox="0 0 500 365"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto"
            role="img"
            aria-label="Interactive brain region map"
          >
            <defs>
              {/* Selected region glow */}
              <filter id="sel-glow" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Subtle depth for unselected */}
              <filter id="depth" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
                <feOffset dx="0.5" dy="1.5" result="off" />
                <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="inner" />
                <feFlood floodColor="hsl(var(--foreground))" floodOpacity="0.08" result="color" />
                <feComposite in="color" in2="inner" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="shadow" />
                </feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect x="0" y="0" width="500" height="365" className="fill-card" rx="16" />

            {/* Brain outline silhouette */}
            <path
              d="M 48,155 C 44,125 48,90 58,65 C 72,38 98,22 130,18 C 165,14 200,16 230,24 C 255,32 275,42 290,46 C 310,42 330,52 348,72 C 370,95 388,128 398,165 C 412,170 430,185 442,205 C 455,228 458,258 452,280 C 446,300 432,315 412,322 C 395,328 375,328 358,318 C 348,332 332,342 312,346 C 288,350 264,344 248,330 C 236,342 220,348 202,344 C 186,340 174,328 168,312 C 152,318 132,316 116,306 C 98,295 82,278 70,258 C 56,238 46,215 44,192 C 42,178 44,165 48,155 Z"
              fill="none"
              className="stroke-border"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              opacity="0.4"
            />

            {/* Render regions */}
            {regionIds.map((regionId) => {
              const region = REGION_PATHS[regionId];
              const { fill, stroke, opacity } = getRegionFill(mode, regionId, scores, affectedRegions);
              const isSelected = selectedRegion === regionId;
              const score = scores[regionId];
              const isAffected = affectedRegions?.includes(regionId);
              const brainRegion = BRAIN_REGIONS.find(r => r.id === regionId);
              const hasData = score && score.trialCount >= 10;
              const isPrimary = PRIMARY_REGIONS.includes(regionId);
              const isOverlay = OVERLAY_REGIONS.includes(regionId);

              // Show label: always for primary, on hover/select for overlays
              const showLabel = isPrimary || isSelected;

              return (
                <Tooltip key={regionId}>
                  <TooltipTrigger asChild>
                    <g
                      className="cursor-pointer group outline-none"
                      onClick={() => onSelectRegion?.(regionId)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${brainRegion?.displayName || region.label}${hasData ? `, ${Math.round(score!.currentScore)}% function` : isAffected ? ', affected by stroke' : ', no exercise data yet'}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectRegion?.(regionId); } }}
                    >
                      {/* Invisible expanded hit area for small overlay regions (min ~44px touch target) */}
                      {isOverlay && (
                        <path
                          d={region.d}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth="16"
                        />
                      )}
                      {/* Focus ring — separate path so it doesn't interfere with fill styling */}
                      <path
                        d={region.d}
                        fill="none"
                        stroke="hsl(var(--ring))"
                        strokeWidth="2.5"
                        className="opacity-0 group-focus-visible:opacity-100 transition-opacity duration-150"
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Region fill path */}
                      <path
                        d={region.d}
                        fill={fill}
                        fillOpacity={opacity}
                        stroke={isSelected ? "hsl(var(--primary))" : stroke}
                        strokeWidth={isSelected ? 3 : 1.2}
                        strokeDasharray={!hasData && mode !== 'injury' ? "3,2" : "none"}
                        filter={isSelected ? "url(#sel-glow)" : "url(#depth)"}
                        className="transition-all duration-300 ease-out"
                      />
                      {/* Hover overlay */}
                      <path
                        d={region.d}
                        fill="white"
                        fillOpacity="0"
                        className="transition-all duration-200 hover:fill-opacity-[0.12] dark:hover:fill-opacity-[0.08] group-focus-visible:fill-opacity-[0.1]"
                        style={{ cursor: 'pointer' }}
                      />

                      {/* Primary region labels — always visible */}
                      {isPrimary && (
                        <text
                          x={region.labelPos.x}
                          y={region.labelPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="pointer-events-none select-none"
                          style={{
                            fontSize: regionId === 'cerebellum' ? '7.5px' : regionId === 'brainstem' ? '7px' : '9px',
                            fontWeight: isSelected ? 700 : 600,
                            fill: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                            letterSpacing: '0.03em',
                            opacity: isSelected ? 1 : 0.85,
                          }}
                        >
                          {region.label}
                        </text>
                      )}

                      {/* Overlay region labels — shown on hover via CSS group, or when selected */}
                      {isOverlay && (
                        <text
                          x={region.labelPos.x}
                          y={region.labelPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={`pointer-events-none select-none transition-opacity duration-200 ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-80 group-focus-within:opacity-80'
                          }`}
                          style={{
                            fontSize: '7.5px',
                            fontWeight: isSelected ? 700 : 500,
                            fill: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                            fontStyle: 'italic',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {region.label}
                        </text>
                      )}

                      {/* Affected pulse dot in injury mode */}
                      {mode === 'injury' && isAffected && (
                        <circle
                          cx={region.labelPos.x + (isPrimary ? 22 : 16)}
                          cy={region.labelPos.y - 10}
                          r="3.5"
                          fill="hsl(0 84% 55%)"
                          stroke="hsl(var(--card))"
                          strokeWidth="1.5"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-popover text-popover-foreground border-border max-w-[220px]">
                    <div className="text-xs space-y-1.5">
                      <p className="font-semibold text-sm">{brainRegion?.displayName || region.label}</p>
                      {isOverlay && (
                        <p className="text-[10px] text-muted-foreground italic">Functional overlay</p>
                      )}
                      {brainRegion && (
                        <div className="flex flex-wrap gap-1">
                          {brainRegion.functionalDomains.map(d => (
                            <span key={d} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] capitalize">{d}</span>
                          ))}
                        </div>
                      )}
                      {hasData ? (
                        <div className="space-y-0.5 pt-1 border-t border-border">
                          <p>Function: <span className="font-bold">{Math.round(score!.currentScore)}%</span></p>
                          <p className="capitalize">Trend: <span className="font-medium">{score!.trend}</span></p>
                          <p className="text-muted-foreground">{score!.trialCount} trials</p>
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
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-2">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className={`w-3 h-3 rounded-sm border inline-block ${item.className || 'border-border'}`}
                style={{ backgroundColor: item.color, opacity: item.className ? 1 : 0.75 }}
              />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
