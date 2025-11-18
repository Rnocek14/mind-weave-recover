import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export interface CaregiverObservations {
  lookingAtScreen: boolean;
  seemsConfused: boolean;
  tooTired: boolean;
  motorLimitation: boolean;
  notes: string;
}

interface CapabilityGracefulExitProps {
  reason: 'fatigue_suspected' | 'no_response' | 'distress_observed' | 'technical_issue';
  onPause: (observations?: CaregiverObservations) => void;
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
  const [observations, setObservations] = useState<CaregiverObservations>({
    lookingAtScreen: false,
    seemsConfused: false,
    tooTired: false,
    motorLimitation: false,
    notes: '',
  });

  const showCaregiverQuestions = reason === 'no_response';

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

        {showCaregiverQuestions && (
          <div className="text-left space-y-4 pt-4 border-t">
            <p className="text-sm font-medium text-foreground">
              For caregiver: What do you notice right now?
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="looking"
                  checked={observations.lookingAtScreen}
                  onCheckedChange={(checked) => 
                    setObservations(prev => ({ ...prev, lookingAtScreen: checked as boolean }))
                  }
                />
                <Label htmlFor="looking" className="text-sm font-normal cursor-pointer">
                  Looking at the screen but not tapping
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="confused"
                  checked={observations.seemsConfused}
                  onCheckedChange={(checked) => 
                    setObservations(prev => ({ ...prev, seemsConfused: checked as boolean }))
                  }
                />
                <Label htmlFor="confused" className="text-sm font-normal cursor-pointer">
                  Seems confused about what to do
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="tired"
                  checked={observations.tooTired}
                  onCheckedChange={(checked) => 
                    setObservations(prev => ({ ...prev, tooTired: checked as boolean }))
                  }
                />
                <Label htmlFor="tired" className="text-sm font-normal cursor-pointer">
                  Too tired / falling asleep
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="motor"
                  checked={observations.motorLimitation}
                  onCheckedChange={(checked) => 
                    setObservations(prev => ({ ...prev, motorLimitation: checked as boolean }))
                  }
                />
                <Label htmlFor="motor" className="text-sm font-normal cursor-pointer">
                  Arm/hand can't reach or press
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">
                Anything else you want to note?
              </Label>
              <Textarea
                id="notes"
                placeholder="Optional notes..."
                value={observations.notes}
                onChange={(e) => setObservations(prev => ({ ...prev, notes: e.target.value }))}
                className="min-h-[60px]"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <Button
            size="lg"
            onClick={() => onPause(showCaregiverQuestions ? observations : undefined)}
            className="w-full"
          >
            {showCaregiverQuestions ? 'Save & Pause Assessment' : 'Pause Assessment'}
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

        {!showCaregiverQuestions && (
          <p className="text-xs text-muted-foreground mt-6">
            For caregivers: You can help guide their hand to tap if needed. 
            This helps us understand their capabilities better.
          </p>
        )}
      </Card>
    </div>
  );
};
