import React from "react";
import brainBase from '@/assets/brain-lateral-base.png';

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
  return (
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
            d="M50,140 C40,110 45,85 60,65 C80,48 110,40 145,40 C180,42 210,50 235,68 C250,85 255,105 250,125 C240,145 220,160 195,170 C165,178 130,182 95,180 C70,177 55,165 50,140 Z"
            mode={mode}
            color={getRegionColor(mode, "frontal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "frontal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="motor_cortex"
            d="M235,65 C248,58 262,55 275,60 C282,75 285,92 283,110 C280,128 275,145 265,158 C255,153 247,143 242,130 C238,112 235,88 235,65 Z"
            mode={mode}
            color={getRegionColor(mode, "motor_cortex", scores, affectedRegions)}
            selected={selectedRegion === "motor_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="somatosensory_cortex"
            d="M275,60 C288,62 301,70 312,82 C318,98 320,116 316,133 C310,148 300,160 288,168 C280,162 274,152 270,140 C267,120 270,88 275,60 Z"
            mode={mode}
            color={getRegionColor(mode, "somatosensory_cortex", scores, affectedRegions)}
            selected={selectedRegion === "somatosensory_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="parietal_lobe"
            d="M312,82 C335,88 358,102 375,122 C388,142 392,168 385,192 C375,212 358,226 335,233 C310,238 285,233 268,218 C258,205 253,186 256,165 C262,140 282,108 312,82 Z"
            mode={mode}
            color={getRegionColor(mode, "parietal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "parietal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="temporal_lobe"
            d="M95,180 C130,192 168,198 205,200 C235,202 258,208 273,222 C280,242 283,265 276,288 C265,306 245,318 218,324 C183,328 145,322 115,305 C92,290 80,268 82,243 C87,215 90,198 95,180 Z"
            mode={mode}
            color={getRegionColor(mode, "temporal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "temporal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="language_areas"
            d="M105,135 C120,140 135,145 150,145 C145,165 135,180 120,190 C100,185 85,170 80,150 C85,140 95,137 105,135 Z"
            mode={mode}
            color={getRegionColor(mode, "language_areas", scores, affectedRegions)}
            selected={selectedRegion === "language_areas"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="occipital_lobe"
            d="M335,233 C362,228 388,233 408,248 C422,264 427,286 420,308 C408,327 388,338 363,342 C335,344 310,334 292,316 C278,300 270,277 275,253 C283,242 303,237 335,233 Z"
            mode={mode}
            color={getRegionColor(mode, "occipital_lobe", scores, affectedRegions)}
            selected={selectedRegion === "occipital_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="cerebellum"
            d="M276,288 C305,294 332,310 350,332 C360,350 364,372 357,394 C346,413 327,425 303,432 C270,437 238,428 215,410 C198,395 188,372 193,347 C203,325 235,308 276,288 Z"
            mode={mode}
            color={getRegionColor(mode, "cerebellum", scores, affectedRegions)}
            selected={selectedRegion === "cerebellum"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="brainstem"
            d="M193,347 C206,352 218,362 228,376 C235,394 235,414 227,432 C216,448 200,456 180,458 C158,456 140,445 130,428 C123,410 127,390 138,374 C152,360 173,354 193,347 Z"
            mode={mode}
            color={getRegionColor(mode, "brainstem", scores, affectedRegions)}
            selected={selectedRegion === "brainstem"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="subcortical"
            d="M195,100 C210,95 230,95 245,105 C250,125 245,145 230,155 C210,160 195,150 185,135 C185,120 188,110 195,100 Z"
            mode={mode}
            color={getRegionColor(mode, "subcortical", scores, affectedRegions)}
            selected={selectedRegion === "subcortical"}
            onClick={onSelectRegion}
          />
        </svg>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        This map is a simplified illustration. Colors show estimated function based on your exercises and assessments, not a live brain scan.
      </p>
    </div>
  );
};

interface BrainRegionPathProps {
  id: RegionId;
  d: string;
  mode: MapMode;
  color: string;
  selected?: boolean;
  onClick?: (id: RegionId) => void;
}

const BrainRegionPath: React.FC<BrainRegionPathProps> = ({
  id,
  d,
  color,
  selected,
  onClick,
}) => {
  return (
    <g
      className="cursor-pointer transition-all duration-200"
      onClick={() => onClick?.(id)}
    >
      <path
        d={d}
        fill={color}
        stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
        strokeWidth={selected ? 3 : 2}
        className="transition-all duration-200 hover:brightness-110"
        style={{ 
          filter: selected ? 'drop-shadow(0 0 8px hsl(var(--primary)))' : 'none'
        }}
      />
    </g>
  );
};
