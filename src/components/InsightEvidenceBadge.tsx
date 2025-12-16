import { memo } from "react";
import { useUiMode } from "@/hooks/useUiMode";
import { Badge } from "@/components/ui/badge";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ChevronDown, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfidenceLevel = 'low' | 'medium' | 'high';

interface InsightEvidenceBadgeProps {
  /** Time window label, e.g., "Last 7 days" */
  windowLabel: string;
  /** Number of samples (utterances, trials, sessions) */
  n: number;
  /** Confidence level based on sample size and data quality */
  confidence: ConfidenceLevel;
  /** Optional data quality percentage (e.g., semantic similarity coverage) */
  dataQuality?: number;
  /** Optional list of evidence points explaining the insight */
  evidencePoints?: string[];
  /** Minimum N required for high confidence (for "why" explanation) */
  minNForHighConfidence?: number;
  /** Patient-friendly alternative message for low confidence */
  patientFriendlyMessage?: string;
  className?: string;
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  label: string;
  icon: typeof CheckCircle;
  variant: 'default' | 'secondary' | 'outline';
  colorClass: string;
}> = {
  high: {
    label: 'High confidence',
    icon: CheckCircle,
    variant: 'default',
    colorClass: 'text-green-600 dark:text-green-400',
  },
  medium: {
    label: 'Medium confidence',
    icon: Info,
    variant: 'secondary',
    colorClass: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    label: 'Building baseline',
    icon: AlertTriangle,
    variant: 'outline',
    colorClass: 'text-muted-foreground',
  },
};

/**
 * Displays evidence and confidence indicators for clinical insights.
 * Shows detailed information in clinician+ modes, simplified in patient/caregiver.
 */
export const InsightEvidenceBadge = memo(function InsightEvidenceBadge({
  windowLabel,
  n,
  confidence,
  dataQuality,
  evidencePoints,
  minNForHighConfidence = 50,
  patientFriendlyMessage,
  className,
}: InsightEvidenceBadgeProps) {
  const { isAtLeast } = useUiMode();
  const isClinicianPlus = isAtLeast('clinician');
  
  const config = CONFIDENCE_CONFIG[confidence];
  const Icon = config.icon;

  // Patient/caregiver: show friendly message only for low confidence
  if (!isClinicianPlus) {
    if (confidence === 'low' && patientFriendlyMessage) {
      return (
        <p className={cn("text-xs text-muted-foreground italic", className)}>
          {patientFriendlyMessage}
        </p>
      );
    }
    // High/medium confidence: don't show anything to patients
    return null;
  }

  // Clinician+ mode: show full evidence badge
  return (
    <Collapsible className={cn("mt-2", className)}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <Icon className={cn("h-3.5 w-3.5", config.colorClass)} />
        <span>
          {windowLabel} • N={n} • {config.label}
        </span>
        <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 pl-5 text-xs space-y-1.5">
        {/* Sample size context */}
        <div className="flex items-center gap-2">
          <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
            {n} / {minNForHighConfidence} samples
          </Badge>
          {n < minNForHighConfidence && (
            <span className="text-muted-foreground">
              ({minNForHighConfidence - n} more for high confidence)
            </span>
          )}
        </div>

        {/* Data quality indicator */}
        {dataQuality !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Data quality:</span>
            <Badge 
              variant={dataQuality >= 80 ? 'default' : dataQuality >= 50 ? 'secondary' : 'outline'}
              className="text-[10px] px-1.5 py-0"
            >
              {dataQuality.toFixed(0)}%
            </Badge>
          </div>
        )}

        {/* Evidence points */}
        {evidencePoints && evidencePoints.length > 0 && (
          <div className="mt-1.5">
            <span className="text-muted-foreground block mb-1">Evidence:</span>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {evidencePoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
});

/**
 * Helper to calculate confidence level from sample size.
 */
export function calculateConfidence(n: number, thresholds = { low: 10, medium: 30 }): ConfidenceLevel {
  if (n >= thresholds.medium) return 'high';
  if (n >= thresholds.low) return 'medium';
  return 'low';
}
