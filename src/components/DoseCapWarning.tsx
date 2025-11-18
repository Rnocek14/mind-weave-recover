import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Coffee } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DoseCapWarningProps {
  minutesPracticed: number;
  dailyCapMinutes: number;
  sessionCapMinutes: number;
  onEndSession: () => void;
  type: 'approaching' | 'warning' | 'limit';
}

export const DoseCapWarning = ({ 
  minutesPracticed, 
  dailyCapMinutes, 
  sessionCapMinutes,
  onEndSession,
  type 
}: DoseCapWarningProps) => {
  const percentComplete = Math.min(100, (minutesPracticed / dailyCapMinutes) * 100);
  const minutesRemaining = Math.max(0, dailyCapMinutes - minutesPracticed);

  if (type === 'limit') {
    return (
      <Alert className="border-destructive bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <AlertTitle className="text-destructive">Daily Practice Limit Reached</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            Excellent work! You've reached your recommended daily practice limit of {dailyCapMinutes} minutes.
          </p>
          <p className="text-sm text-muted-foreground">
            Rest is crucial for neuroplasticity. Taking breaks allows your brain to consolidate what you've learned.
          </p>
          <div className="flex gap-2">
            <Button onClick={onEndSession} className="gap-2">
              <Coffee className="h-4 w-4" />
              End Session & Rest
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (type === 'warning') {
    return (
      <Alert className="border-orange-500 bg-orange-50">
        <Clock className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-600">Approaching Practice Limit</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            You've practiced for {minutesPracticed} minutes today. 
            Only {minutesRemaining} minutes remaining to avoid fatigue.
          </p>
          <Progress value={percentComplete} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Consider wrapping up soon to maintain quality practice without overexertion.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // type === 'approaching'
  return (
    <Alert className="border-primary bg-primary/10">
      <Clock className="h-4 w-4 text-primary" />
      <AlertTitle>Great Progress Today!</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">
          You've practiced for {minutesPracticed} minutes. 
          About {minutesRemaining} minutes left before your daily goal.
        </p>
        <Progress value={percentComplete} className="h-2" />
      </AlertDescription>
    </Alert>
  );
};
