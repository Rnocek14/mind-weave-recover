import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CapabilityGatingInfoProps {
  hasAssessment: boolean;
  lockedCount: number;
  adaptedCount: number;
  hasSoftOverride?: boolean;
  onStartAssessment?: () => void;
}

export const CapabilityGatingInfo = ({ 
  hasAssessment, 
  lockedCount, 
  adaptedCount,
  hasSoftOverride = false,
  onStartAssessment 
}: CapabilityGatingInfoProps) => {
  if (!hasAssessment) {
    return (
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Complete Capability Assessment for Personalization</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Take a quick 5-7 minute assessment to unlock smart exercise personalization. 
            We'll automatically adjust exercises to match your current abilities—no reading or speaking required.
          </p>
          {onStartAssessment && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onStartAssessment}
              className="mt-2"
            >
              Start Assessment
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (lockedCount === 0 && adaptedCount === 0) {
    return null; // All exercises accessible, no adaptations needed
  }

  return (
    <Alert className="mb-6 border-primary/50 bg-primary/5">
      <Shield className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary">
        {hasSoftOverride ? 'Extra Support Mode Active' : 'Smart Exercise Personalization Active'}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        {hasSoftOverride && (
          <p className="text-sm font-medium text-primary">
            We're offering exercises with additional support since fewer exercises matched your current level.
          </p>
        )}
        <div className="flex items-center gap-4 text-sm">
          {adaptedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                <strong>{adaptedCount}</strong> exercise{adaptedCount !== 1 ? 's' : ''} adapted to your capabilities
              </span>
            </div>
          )}
          {lockedCount > 0 && (
            <div className="text-muted-foreground">
              <strong>{lockedCount}</strong> exercise{lockedCount !== 1 ? 's' : ''} temporarily unavailable
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Exercises are automatically adjusted with larger targets, extended time limits, and simplified 
          instructions based on your capability assessment. As your abilities improve, more exercises will unlock.
        </p>
      </AlertDescription>
    </Alert>
  );
};
