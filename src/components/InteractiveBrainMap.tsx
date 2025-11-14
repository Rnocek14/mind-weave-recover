import React from "react";

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
      <div className="relative w-full pb-[65%] rounded-2xl bg-background border border-border shadow-sm overflow-hidden">
        <svg viewBox="0 0 400 260" className="absolute inset-0 w-full h-full">
          <BrainRegionPath
            id="frontal_lobe"
            d="M55,120 C40,75 80,40 150,40 C195,40 210,60 215,85 C185,110 150,125 105,135 C80,140 65,135 55,120 Z"
            mode={mode}
            color={getRegionColor(mode, "frontal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "frontal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="motor_cortex"
            d="M205,60 C215,55 230,55 245,65 C240,80 235,95 225,110 C210,105 200,95 195,80 Z"
            mode={mode}
            color={getRegionColor(mode, "motor_cortex", scores, affectedRegions)}
            selected={selectedRegion === "motor_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="somatosensory_cortex"
            d="M245,65 C260,75 270,90 275,105 C260,120 245,130 230,135 C225,120 223,115 225,110 Z"
            mode={mode}
            color={getRegionColor(mode, "somatosensory_cortex", scores, affectedRegions)}
            selected={selectedRegion === "somatosensory_cortex"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="parietal_lobe"
            d="M230,75 C260,60 300,70 325,95 C330,125 320,150 295,165 C270,175 245,170 225,155 C235,135 240,125 245,115 Z"
            mode={mode}
            color={getRegionColor(mode, "parietal_lobe", scores, affectedRegions)}
            selected={selectedRegion === "parietal_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="temporal_lobe"
            d="M150,135 C190,135 220,140 240,155 C245,195 230,215 200,225 C165,235 125,225 105,205 C105,180 120,160 150,150 Z"
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
            d="M295,135 C325,135 350,150 360,170 C355,195 335,210 310,215 C285,210 270,195 265,180 C275,165 285,150 295,135 Z"
            mode={mode}
            color={getRegionColor(mode, "occipital_lobe", scores, affectedRegions)}
            selected={selectedRegion === "occipital_lobe"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="cerebellum"
            d="M220,190 C240,190 260,200 270,220 C260,240 240,255 215,255 C195,252 180,240 175,225 C185,205 200,195 220,190 Z"
            mode={mode}
            color={getRegionColor(mode, "cerebellum", scores, affectedRegions)}
            selected={selectedRegion === "cerebellum"}
            onClick={onSelectRegion}
          />

          <BrainRegionPath
            id="brainstem"
            d="M185,205 C195,205 205,210 210,225 C210,240 205,252 195,260 C180,260 170,250 168,238 C170,225 175,215 185,205 Z"
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
