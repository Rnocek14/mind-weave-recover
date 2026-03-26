import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TrendingUp, Clock, Flame, X } from "lucide-react";
import type { LastSessionFeedback } from "@/hooks/useLastSessionFeedback";

interface PostSessionCardProps {
  feedback: LastSessionFeedback;
  onDismiss: () => void;
}

function getHeadline(feedback: LastSessionFeedback): { text: string; emoji: string } {
  const { accuracy, correctDelta, streak } = feedback;
  if (accuracy >= 90) return { text: "Amazing work!", emoji: "🎉" };
  if (accuracy >= 75) return { text: "Great session!", emoji: "💪" };
  if (correctDelta > 0) return { text: "You're improving!", emoji: "📈" };
  if (streak >= 3) return { text: "Consistency pays off!", emoji: "🔥" };
  return { text: "You showed up — that matters!", emoji: "💛" };
}

export function PostSessionCard({ feedback, onDismiss }: PostSessionCardProps) {
  const { text, emoji } = getHeadline(feedback);

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-background to-success/5 shadow-lg animate-fade-in">
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <CardContent className="pt-6 pb-5 space-y-4">
        {/* Headline */}
        <div className="text-center space-y-1">
          <p className="text-3xl">{emoji}</p>
          <h3 className="text-xl font-bold text-foreground">{text}</h3>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Correct answers */}
          <div className="text-center p-3 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle2 className="w-5 h-5 mx-auto text-success mb-1" />
            <p className="text-lg font-bold text-foreground">
              {feedback.correct}/{feedback.total}
            </p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>

          {/* Duration */}
          <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Clock className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">
              {feedback.durationMin}m
            </p>
            <p className="text-xs text-muted-foreground">Practiced</p>
          </div>

          {/* Streak or delta */}
          <div className="text-center p-3 rounded-xl bg-warning/10 border border-warning/20">
            {feedback.correctDelta > 0 ? (
              <>
                <TrendingUp className="w-5 h-5 mx-auto text-success mb-1" />
                <p className="text-lg font-bold text-foreground">
                  +{feedback.correctDelta}
                </p>
                <p className="text-xs text-muted-foreground">vs last time</p>
              </>
            ) : (
              <>
                <Flame className="w-5 h-5 mx-auto text-warning mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {feedback.streak}
                </p>
                <p className="text-xs text-muted-foreground">Day streak</p>
              </>
            )}
          </div>
        </div>

        {/* Motivational nudge */}
        <p className="text-sm text-center text-muted-foreground">
          {feedback.streak >= 3
            ? `${feedback.streak} days in a row — keep the momentum going!`
            : feedback.correctDelta > 0
              ? `${feedback.correctDelta} more correct than last session — real progress!`
              : "Every session builds stronger connections 🧠"}
        </p>
      </CardContent>
    </Card>
  );
}
