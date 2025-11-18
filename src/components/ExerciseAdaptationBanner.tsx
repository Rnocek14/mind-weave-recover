import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";
import { getAdaptationSummary } from "@/lib/exerciseGating";
import type { ExerciseAdaptation } from "@/lib/exerciseGating";

interface ExerciseAdaptationBannerProps {
  adaptation: ExerciseAdaptation | null;
  showDetails?: boolean;
}

export const ExerciseAdaptationBanner = ({ 
  adaptation, 
  showDetails = false 
}: ExerciseAdaptationBannerProps) => {
  if (!adaptation) return null;

  const summary = getAdaptationSummary(adaptation);
  
  if (summary.length === 0) return null;

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Sparkles className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary">Exercise Adapted to Your Capabilities</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{adaptation.reason}</p>
        {showDetails && summary.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium mb-1">Active Adaptations:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {summary.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
