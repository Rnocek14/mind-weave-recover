/**
 * ClinicalTerm Component
 * 
 * Displays patient-friendly term labels with clinician tooltips.
 * Uses the insightLanguageMap for consistent terminology.
 */

import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiMode } from '@/hooks/useUiMode';
import { 
  getErrorTermInfo, 
  getCueTermInfo, 
  type TermMapping 
} from '@/lib/insightLanguageMap';

interface ClinicalTermProps {
  type: 'error' | 'cue';
  value: string | null | undefined;
  showDescription?: boolean;
  className?: string;
}

export const ClinicalTerm = memo(({ 
  type, 
  value, 
  showDescription = false,
  className = '' 
}: ClinicalTermProps) => {
  const { isAtLeast } = useUiMode();
  const showClinicianTooltip = isAtLeast('clinician');
  
  const termInfo: TermMapping = type === 'error' 
    ? getErrorTermInfo(value) 
    : getCueTermInfo(value);

  const content = (
    <span className={className}>
      {termInfo.label}
      {showDescription && termInfo.description && (
        <span className="text-muted-foreground ml-1">— {termInfo.description}</span>
      )}
    </span>
  );

  // Only show tooltip for clinicians when there's a different clinical term
  if (showClinicianTooltip && termInfo.clinicalTerm !== termInfo.label) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`cursor-help border-b border-dotted border-muted-foreground/50 ${className}`}>
              {termInfo.label}
              {showDescription && termInfo.description && (
                <span className="text-muted-foreground ml-1">— {termInfo.description}</span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{termInfo.clinicalTerm}</p>
            {termInfo.description && (
              <p className="text-xs text-muted-foreground max-w-xs">{termInfo.description}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
});

ClinicalTerm.displayName = 'ClinicalTerm';
