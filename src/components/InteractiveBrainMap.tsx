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
      <div className="relative w-full pb-[65%] rounded-2xl bg-slate-50 shadow-sm overflow-hidden">
        <img
          src={brainBase}
          alt="Brain lateral view"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        />
        <svg viewBox="0 0 500 335" className="absolute inset-0 w-full h-full">
          <BrainRegionPath
            id="frontal_lobe"
            d="M85,155 C75,125 80,95 95,70 C115,50 145,40 180,40 C215,45 240,55 260,75 C270,92 272,112 268,130 C255,148 235,160 210,168 C180,175 145,178 115,175 C100,172 90,165 85,155 Z"
            mode={mode}
            color={getRegionColor(mode, "frontal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "frontal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="motor_cortex"
            d="M268,70 C280,65 292,63 304,68 C310,82 312,98 310,115 C306,132 300,147 290,158 C280,152 272,142 268,128 C265,110 264,88 268,70 Z"
            mode={mode}
            color={getRegionColor(mode, "motor_cortex", scores, affectedRegions)}
            selected={selectedRegion === "motor_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="somatosensory_cortex"
            d="M304,68 C316,70 328,78 338,90 C343,105 344,122 340,138 C334,152 324,163 312,168 C304,162 298,152 295,140 C292,122 295,92 304,68 Z"
            mode={mode}
            color={getRegionColor(mode, "somatosensory_cortex", scores, affectedRegions)}
            selected={selectedRegion === "somatosensory_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="parietal_lobe"
            d="M338,90 C360,95 382,108 398,128 C408,148 410,172 403,195 C392,215 373,228 350,233 C325,236 302,230 285,215 C275,202 270,183 272,162 C278,138 302,108 338,90 Z"
            mode={mode}
            color={getRegionColor(mode, "parietal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "parietal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="temporal_lobe"
            d="M115,175 C150,185 190,190 228,192 C255,194 275,198 288,210 C295,230 298,252 290,273 C278,290 258,300 232,305 C198,308 160,302 130,285 C108,270 98,248 100,225 C105,202 108,188 115,175 Z"
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
            d="M350,233 C375,228 400,232 420,245 C432,260 436,280 430,300 C420,318 402,328 380,332 C355,334 332,325 315,308 C302,292 295,270 300,248 C308,238 326,235 350,233 Z"
            mode={mode}
            color={getRegionColor(mode, "occipital_lobe", scores, affectedRegions)}
            selected={selectedRegion === "occipital_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="cerebellum"
            d="M232,273 C260,278 285,292 302,312 C312,328 316,348 310,368 C300,385 282,396 260,402 C230,406 200,398 178,380 C162,365 153,342 158,318 C168,298 200,283 232,273 Z"
            mode={mode}
            color={getRegionColor(mode, "cerebellum", scores, affectedRegions)}
            selected={selectedRegion === "cerebellum"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="brainstem"
            d="M158,318 C170,322 182,330 192,342 C198,358 198,376 190,392 C180,405 165,412 148,412 C128,410 112,400 104,385 C98,368 102,350 112,336 C125,324 142,320 158,318 Z"
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
