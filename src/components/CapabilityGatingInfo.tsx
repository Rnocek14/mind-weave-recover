import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { memo } from "react";

interface CapabilityGatingInfoProps {
  hasAssessment: boolean;
  lockedCount: number;
  adaptedCount: number;
  hasSoftOverride?: boolean;
  onStartAssessment?: () => void;
}

export const CapabilityGatingInfo = memo(function CapabilityGatingInfo({ 
  hasAssessment, 
  lockedCount, 
  adaptedCount,
  hasSoftOverride = false,
  onStartAssessment 
}: CapabilityGatingInfoProps) {
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
        {hasSoftOverride ? 'Extended Access Mode Active' : 'Smart Exercise Personalization Active'}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        {hasSoftOverride && (
          <div className="p-3 rounded-md bg-background/50 border border-primary/20">
            <p className="text-sm font-semibold text-foreground mb-2">
              🌟 We've unlocked extra exercises for you
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Based on your current scores, we're offering a wider variety of exercises with enhanced support. 
              This gives you more options to practice while we gradually adjust difficulty. As you progress 
              and your capability scores improve, even more exercises will become available naturally.
            </p>
            <p className="text-xs text-primary mt-2 font-medium">
              Think of this as training wheels - we're here to help you succeed! 🚀
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm">
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
});
