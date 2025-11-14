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
        <svg viewBox="0 0 400 260" className="absolute inset-0 w-full h-full">
          <BrainRegionPath
            id="frontal_lobe"
            d="M45,125 C35,95 40,70 55,50 C75,35 105,28 140,28 C175,28 200,35 218,50 C228,62 232,78 230,95 C220,110 205,122 185,130 C160,135 130,138 100,138 C75,136 58,132 45,125 Z"
            mode={mode}
            color={getRegionColor(mode, "frontal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "frontal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="motor_cortex"
            d="M228,50 C238,45 248,43 258,46 C263,58 265,72 263,88 C260,102 255,115 248,125 C240,120 233,110 228,98 C225,85 224,68 228,50 Z"
            mode={mode}
            color={getRegionColor(mode, "motor_cortex", scores, affectedRegions)}
            selected={selectedRegion === "motor_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="somatosensory_cortex"
            d="M258,46 C268,48 278,54 286,65 C290,78 291,93 288,108 C283,120 275,128 265,133 C258,128 253,120 250,110 C248,95 251,70 258,46 Z"
            mode={mode}
            color={getRegionColor(mode, "somatosensory_cortex", scores, affectedRegions)}
            selected={selectedRegion === "somatosensory_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="parietal_lobe"
            d="M286,65 C305,68 325,78 340,95 C348,112 350,132 346,152 C338,168 325,180 308,185 C288,188 270,185 255,175 C248,165 245,150 248,133 C255,115 268,85 286,65 Z"
            mode={mode}
            color={getRegionColor(mode, "parietal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "parietal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="temporal_lobe"
            d="M95,138 C125,145 160,148 188,150 C208,152 228,155 242,165 C248,180 250,198 245,215 C235,228 218,235 198,238 C170,240 140,235 115,222 C95,210 85,192 85,172 C88,155 90,145 95,138 Z"
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
            d="M308,185 C328,182 348,185 365,195 C375,208 378,225 375,242 C368,255 355,262 340,265 C320,266 302,260 288,248 C278,235 273,218 275,200 C280,192 293,187 308,185 Z"
            mode={mode}
            color={getRegionColor(mode, "occipital_lobe", scores, affectedRegions)}
            selected={selectedRegion === "occipital_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="cerebellum"
            d="M245,215 C265,218 285,228 298,242 C305,253 308,268 305,282 C298,295 285,304 268,308 C245,310 222,305 205,292 C192,280 185,262 188,245 C195,230 218,218 245,215 Z"
            mode={mode}
            color={getRegionColor(mode, "cerebellum", scores, affectedRegions)}
            selected={selectedRegion === "cerebellum"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="brainstem"
            d="M188,245 C198,248 208,255 215,265 C220,278 220,292 215,305 C208,315 197,320 185,320 C170,318 158,310 152,298 C148,285 150,270 158,260 C168,252 178,247 188,245 Z"
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
