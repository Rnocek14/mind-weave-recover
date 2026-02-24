import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Battery, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DailyReadiness } from "@/hooks/useDailyReadiness";

interface ReadinessStatusCardProps {
  checkin: DailyReadiness | null;
  onCheckIn: () => void;
  isLoading?: boolean;
}

const fatigueLabels: Record<number, { label: string; emoji: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  1: { label: "Fresh", emoji: "💪", variant: "default" },
  2: { label: "Good", emoji: "🙂", variant: "default" },
  3: { label: "Okay", emoji: "😐", variant: "secondary" },
  4: { label: "Tired", emoji: "😮‍💨", variant: "outline" },
  5: { label: "Exhausted", emoji: "😴", variant: "destructive" },
};

export const ReadinessStatusCard = ({ checkin, onCheckIn, isLoading }: ReadinessStatusCardProps) => {
  if (isLoading) return null;

  if (!checkin) {
    return (
      <Card className="border-dashed border-2 border-primary/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Battery className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Daily readiness check-in</p>
              <p className="text-xs text-muted-foreground">20 seconds — helps personalize your session</p>
            </div>
          </div>
          <Button size="sm" onClick={onCheckIn} variant="default">
            Check in
          </Button>
        </CardContent>
      </Card>
    );
  }

  const info = fatigueLabels[checkin.fatigue_rating] || fatigueLabels[3];

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{info.emoji}</span>
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              Energy: {info.label}
              <Check className="w-3.5 h-3.5 text-success" />
            </p>
            {checkin.fatigue_limited_practice && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Fatigue limited practice yesterday
              </p>
            )}
          </div>
        </div>
        <Badge variant={info.variant} className="text-xs">
          {checkin.fatigue_rating}/5
        </Badge>
      </CardContent>
    </Card>
  );
};
