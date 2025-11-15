import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VascularTerritoryOverlayProps {
  affectedTerritories: string[];
}

interface TerritoryPath {
  id: string;
  displayName: string;
  color: string;
  path: string;
}

const TERRITORY_PATHS: TerritoryPath[] = [
  {
    id: 'left_mca',
    displayName: 'Left MCA',
    color: 'rgba(251, 146, 60, 0.4)', // orange
    path: 'M50,140 C40,110 45,85 60,65 C80,48 110,40 145,40 C180,42 210,50 235,68 L235,175 L200,200 L150,210 L95,180 C70,177 55,165 50,140 Z'
  },
  {
    id: 'right_mca',
    displayName: 'Right MCA',
    color: 'rgba(251, 146, 60, 0.4)',
    path: 'M50,140 C40,110 45,85 60,65 C80,48 110,40 145,40 C180,42 210,50 235,68 L235,175 L200,200 L150,210 L95,180 C70,177 55,165 50,140 Z'
  },
  {
    id: 'left_pca',
    displayName: 'Left PCA',
    color: 'rgba(168, 85, 247, 0.4)', // purple
    path: 'M420,115 Q460,120 480,140 L470,200 Q440,205 410,195 L380,250 Q350,240 340,210 L340,175 Q370,190 410,185 L420,115 Z'
  },
  {
    id: 'right_pca',
    displayName: 'Right PCA',
    color: 'rgba(168, 85, 247, 0.4)',
    path: 'M420,115 Q460,120 480,140 L470,200 Q440,205 410,195 L380,250 Q350,240 340,210 L340,175 Q370,190 410,185 L420,115 Z'
  },
  {
    id: 'left_aca',
    displayName: 'Left ACA',
    color: 'rgba(59, 130, 246, 0.4)', // blue
    path: 'M60,65 C80,48 110,40 145,40 L180,42 L200,50 L220,40 L235,50 L240,80 L220,100 L180,90 L140,85 L100,80 L70,75 Z'
  },
  {
    id: 'right_aca',
    displayName: 'Right ACA',
    color: 'rgba(59, 130, 246, 0.4)',
    path: 'M60,65 C80,48 110,40 145,40 L180,42 L200,50 L220,40 L235,50 L240,80 L220,100 L180,90 L140,85 L100,80 L70,75 Z'
  },
  {
    id: 'left_cerebellar',
    displayName: 'Left Cerebellar',
    color: 'rgba(34, 197, 94, 0.4)', // green
    path: 'M380,250 Q400,255 420,250 L420,290 Q400,295 380,290 Z'
  },
  {
    id: 'right_cerebellar',
    displayName: 'Right Cerebellar',
    color: 'rgba(34, 197, 94, 0.4)',
    path: 'M420,250 Q440,255 460,250 L460,290 Q440,295 420,290 Z'
  },
  {
    id: 'basilar',
    displayName: 'Basilar',
    color: 'rgba(239, 68, 68, 0.4)', // red
    path: 'M350,280 Q370,290 390,280 L390,320 Q370,330 350,320 Z M380,250 Q420,260 460,250 L460,290 Q420,300 380,290 Z'
  }
];

export const VascularTerritoryOverlay: React.FC<VascularTerritoryOverlayProps> = ({ 
  affectedTerritories 
}) => {
  const normalizeTerritory = (territory: string): string => {
    const lower = territory.toLowerCase();
    if (lower.includes('left') && lower.includes('middle cerebral') || lower.includes('left mca')) return 'left_mca';
    if (lower.includes('right') && lower.includes('middle cerebral') || lower.includes('right mca')) return 'right_mca';
    if (lower.includes('left') && lower.includes('posterior cerebral') || lower.includes('left pca')) return 'left_pca';
    if (lower.includes('right') && lower.includes('posterior cerebral') || lower.includes('right pca')) return 'right_pca';
    if (lower.includes('left') && lower.includes('anterior cerebral') || lower.includes('left aca')) return 'left_aca';
    if (lower.includes('right') && lower.includes('anterior cerebral') || lower.includes('right aca')) return 'right_aca';
    if (lower.includes('left') && lower.includes('cerebell')) return 'left_cerebellar';
    if (lower.includes('right') && lower.includes('cerebell')) return 'right_cerebellar';
    if (lower.includes('basilar')) return 'basilar';
    return territory;
  };

  const normalizedTerritories = affectedTerritories.map(normalizeTerritory);

  return (
    <TooltipProvider delayDuration={200}>
      <svg viewBox="0 0 500 335" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {TERRITORY_PATHS.map((territory) => {
          const isAffected = normalizedTerritories.includes(territory.id);
          if (!isAffected) return null;

          return (
            <Tooltip key={territory.id}>
              <TooltipTrigger asChild>
                <path
                  d={territory.path}
                  fill={territory.color}
                  stroke={territory.color.replace('0.4', '0.8')}
                  strokeWidth="2"
                  className="pointer-events-auto transition-opacity hover:opacity-90"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-popover border">
                <div className="text-xs">
                  <p className="font-semibold">{territory.displayName}</p>
                  <p className="text-muted-foreground">Affected Territory</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </svg>
    </TooltipProvider>
  );
};
