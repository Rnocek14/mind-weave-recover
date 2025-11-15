import React from "react";
import brainBase from '@/assets/brain-lateral-base.png';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BRAIN_REGIONS } from '@/lib/brainRegionMapper';

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
  selectedRegion?: RegionId | null;
  onSelectRegion?: (region: RegionId) => void;
}

function getRegionColor(
  mode: MapMode,
  regionId: RegionId,
  scores: InteractiveBrainMapProps["scores"],
  affectedRegions?: RegionId[]
): string {
  const score = scores[regionId];

  if (mode === "injury") {
    if (affectedRegions?.includes(regionId)) {
      return "rgba(220,38,38,0.75)";
    }
    return "rgba(148,163,184,0.25)";
  }

  if (!score || score.trialCount < 10) {
    return "rgba(148,163,184,0.45)";
  }

  if (mode === "function") {
    if (score.currentScore >= 70) return "rgba(34,197,94,0.65)";
    if (score.currentScore >= 50) return "rgba(234,179,8,0.65)";
    if (score.currentScore >= 30) return "rgba(249,115,22,0.65)";
    return "rgba(220,38,38,0.75)";
  }

  if (score.trend === "improving") return "rgba(59,130,246,0.7)";
  if (score.trend === "declining") return "rgba(249,115,22,0.7)";
  return "rgba(148,163,184,0.45)";
}

export const InteractiveBrainMap: React.FC<InteractiveBrainMapProps> = ({
  mode,
  scores,
  affectedRegions,
  selectedRegion,
  onSelectRegion,
}) => {
  const getRegionDisplayName = (regionId: RegionId): string => {
    const region = BRAIN_REGIONS.find(r => r.id === regionId);
    return region?.displayName || regionId.replace(/_/g, ' ');
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full max-w-3xl mx-auto">
        <div className="relative w-full pb-[67%] rounded-2xl bg-slate-50 shadow-sm overflow-hidden">
          <img
            src={brainBase}
            alt="Brain lateral view"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          />
          <svg viewBox="0 0 500 335" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
            <BrainRegionPath
              id="frontal_lobe"
              displayName={getRegionDisplayName("frontal_lobe")}
              d="M50,140 C40,110 45,85 60,65 C80,48 110,40 145,40 C180,42 210,50 235,68 C250,85 255,105 250,125 C240,145 220,160 195,170 C165,178 130,182 95,180 C70,177 55,165 50,140 Z"
              mode={mode}
              color={getRegionColor(mode, "frontal_lobe", scores, affectedRegions)}
              selected={selectedRegion === "frontal_lobe"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="motor_cortex"
              displayName={getRegionDisplayName("motor_cortex")}
              d="M235,65 C248,58 262,55 275,60 C282,75 285,92 283,110 C280,128 275,145 265,158 C255,153 247,143 242,130 C238,112 235,88 235,65 Z"
              mode={mode}
              color={getRegionColor(mode, "motor_cortex", scores, affectedRegions)}
              selected={selectedRegion === "motor_cortex"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="somatosensory_cortex"
              displayName={getRegionDisplayName("somatosensory_cortex")}
              d="M275,60 C288,62 301,70 312,82 C318,98 320,116 316,133 C310,148 300,160 288,168 C280,162 274,152 270,140 C267,120 270,88 275,60 Z"
              mode={mode}
              color={getRegionColor(mode, "somatosensory_cortex", scores, affectedRegions)}
              selected={selectedRegion === "somatosensory_cortex"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="parietal_lobe"
              displayName={getRegionDisplayName("parietal_lobe")}
              d="M312,82 C335,88 358,102 375,122 C388,142 392,168 385,192 C375,212 358,226 335,233 C310,238 285,233 268,218 C258,205 253,186 256,165 C262,140 282,108 312,82 Z"
              mode={mode}
              color={getRegionColor(mode, "parietal_lobe", scores, affectedRegions)}
              selected={selectedRegion === "parietal_lobe"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="temporal_lobe"
              displayName={getRegionDisplayName("temporal_lobe")}
              d="M50,180 C55,205 70,228 90,245 C115,262 145,270 175,268 C200,266 220,255 235,238 C240,225 242,210 238,195 C230,185 215,178 195,178 C160,180 110,185 75,185 C60,184 52,182 50,180 Z"
              mode={mode}
              color={getRegionColor(mode, "temporal_lobe", scores, affectedRegions)}
              selected={selectedRegion === "temporal_lobe"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="occipital_lobe"
              displayName={getRegionDisplayName("occipital_lobe")}
              d="M375,122 C400,130 425,142 445,160 C460,178 468,202 465,228 C462,250 448,268 428,278 C405,286 378,285 358,272 C345,260 338,242 340,222 C345,195 358,158 375,122 Z"
              mode={mode}
              color={getRegionColor(mode, "occipital_lobe", scores, affectedRegions)}
              selected={selectedRegion === "occipital_lobe"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="cerebellum"
              displayName={getRegionDisplayName("cerebellum")}
              d="M320,250 C340,248 360,252 375,262 C390,275 398,295 395,315 C390,330 375,340 355,342 C330,344 305,337 290,322 C280,310 276,293 280,275 C285,260 300,252 320,250 Z"
              mode={mode}
              color={getRegionColor(mode, "cerebellum", scores, affectedRegions)}
              selected={selectedRegion === "cerebellum"}
              onClick={onSelectRegion}
            />

            <BrainRegionPath
              id="brainstem"
              displayName={getRegionDisplayName("brainstem")}
              d="M280,270 C285,275 288,285 288,295 C288,310 282,325 270,332 C260,337 248,335 240,328 C232,320 228,308 230,295 C232,282 240,272 252,268 C262,265 272,265 280,270 Z"
              mode={mode}
              color={getRegionColor(mode, "brainstem", scores, affectedRegions)}
              selected={selectedRegion === "brainstem"}
              onClick={onSelectRegion}
            />
          </svg>
        </div>
      </div>
    </TooltipProvider>
  );
};

interface BrainRegionPathProps {
  id: RegionId;
  displayName: string;
  d: string;
  mode: MapMode;
  color: string;
  selected?: boolean;
  onClick?: (id: RegionId) => void;
}

const BrainRegionPath: React.FC<BrainRegionPathProps> = ({
  id,
  displayName,
  d,
  color,
  selected,
  onClick,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g
          className="cursor-pointer transition-all duration-300 ease-out"
          onClick={() => onClick?.(id)}
        >
          <path
            d={d}
            fill={color}
            stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
            strokeWidth={selected ? 3 : 2}
            className="transition-all duration-300 ease-out hover:brightness-125 hover:saturate-150"
            style={{ 
              filter: selected 
                ? 'drop-shadow(0 0 8px hsl(var(--primary)))' 
                : 'none',
              transformOrigin: 'center',
            }}
          />
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover text-popover-foreground border-border">
        <p className="font-medium">{displayName}</p>
      </TooltipContent>
    </Tooltip>
  );
};
