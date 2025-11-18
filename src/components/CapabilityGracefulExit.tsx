import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CapabilityGracefulExitProps {
  reason: 'fatigue_suspected' | 'no_response' | 'distress_observed' | 'technical_issue';
  onPause: () => void;
  onContinue?: () => void;
}

const REASON_MESSAGES = {
  fatigue_suspected: {
    emoji: "😌",
    title: "Let's take a break",
    description: "It looks like you might need some rest. That's completely okay!",
  },
  no_response: {
    emoji: "🤔",
    title: "Let's pause for now",
    description: "We're not seeing responses yet. Let's try again when you're ready.",
  },
  distress_observed: {
    emoji: "🤗",
    title: "Let's stop here",
    description: "Your comfort is most important. We can continue another time.",
  },
  technical_issue: {
    emoji: "🔧",
    title: "Technical difficulty",
    description: "We're having some technical issues. Let's try again shortly.",
  },
};

export const CapabilityGracefulExit = ({ reason, onPause, onContinue }: CapabilityGracefulExitProps) => {
  const message = REASON_MESSAGES[reason];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="text-6xl mb-4">{message.emoji}</div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            {message.title}
          </h2>
          <p className="text-muted-foreground">
            {message.description}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button
            size="lg"
            onClick={onPause}
            className="w-full"
          >
            Pause Assessment
          </Button>
          
          {onContinue && (
            <Button
              size="lg"
              variant="outline"
              onClick={onContinue}
              className="w-full"
            >
              Continue Anyway
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          For caregivers: You can help guide their hand to tap if needed. 
          This helps us understand their capabilities better.
        </p>
      </Card>
    </div>
  );
};
