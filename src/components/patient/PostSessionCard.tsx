import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TrendingUp, Clock, Flame, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXERCISE_DOMAIN_MAP } from "@/lib/exerciseDomainLookup";
import type { LastSessionFeedback } from "@/hooks/useLastSessionFeedback";

interface PostSessionCardProps {
  feedback: LastSessionFeedback;
  onDismiss: () => void;
  onStartSession?: () => void;
}

const DOMAIN_LABELS: Record<string, string> = {
  lexical_retrieval: "word finding",
  semantic_depth: "meaning & categories",
  executive_function: "thinking & planning",
  syntax: "sentence building",
  phonology: "sounds & pronunciation",
  discourse: "conversation",
  motor: "movement",
  visual_spatial: "visual skills",
};

function getDomainLabel(exercises: string[]): string | null {
  if (!exercises.length) return null;
  const slug = exercises[0].replace(/_/g, "-");
  const domain = EXERCISE_DOMAIN_MAP[slug];
  return domain ? DOMAIN_LABELS[domain] || null : null;
}

function getHeadline(feedback: LastSessionFeedback): { text: string; emoji: string } {
  const { accuracy, correctDelta, streak } = feedback;
  if (accuracy >= 90) return { text: "Amazing work!", emoji: "🎉" };
  if (accuracy >= 75) return { text: "Great session!", emoji: "💪" };
  if (correctDelta > 0) return { text: "You're improving!", emoji: "📈" };
  if (streak >= 3) return { text: "Consistency pays off!", emoji: "🔥" };
  return { text: "You showed up — that matters!", emoji: "💛" };
}

export function PostSessionCard({ feedback, onDismiss, onStartSession }: PostSessionCardProps) {
  const [minimized, setMinimized] = useState(false);
  const { text, emoji } = getHeadline(feedback);
  const domainLabel = getDomainLabel(feedback.exerciseNames);

  const handleDismiss = () => {
    setMinimized(true);
    // Keep mini banner visible, full dismiss on second tap
  };

  // Mini banner after first dismiss
  if (minimized) {
    return (
      <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/10 text-sm text-muted-foreground animate-fade-in">
        <button
          onClick={() => setMinimized(false)}
          className="flex-1 text-left hover:text-foreground transition-colors"
        >
          {emoji} {text} — {feedback.correct}/{feedback.total} correct
          {feedback.streak >= 2 && ` • ${feedback.streak}-day streak`}
        </button>
        <button onClick={onDismiss} className="p-0.5 ml-2 hover:text-foreground transition-colors" aria-label="Dismiss">
          <X className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-lg animate-fade-in">
      {/* Dismiss → minimize */}
      <button
        onClick={handleDismiss}
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
          {domainLabel && (
            <p className="text-sm text-primary font-medium">
              You improved in {domainLabel} today 💬
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Correct answers */}
          <div className="text-center p-3 rounded-xl bg-accent/30 border border-accent/40">
            <CheckCircle2 className="w-5 h-5 mx-auto text-primary mb-1" />
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
          <div className="text-center p-3 rounded-xl bg-accent/30 border border-accent/40">
            {feedback.correctDelta > 0 ? (
              <>
                <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">
                  +{feedback.correctDelta}
                </p>
                <p className="text-xs text-muted-foreground">vs last session</p>
              </>
            ) : (
              <>
                <Flame className="w-5 h-5 mx-auto text-primary mb-1" />
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
              ? `You got ${feedback.correctDelta} more correct answers than yesterday — real progress!`
              : "Every session builds stronger connections 🧠"}
        </p>

        {/* Next action CTA */}
        {onStartSession && (
          <Button
            onClick={onStartSession}
            variant="ghost"
            size="sm"
            className="w-full text-primary hover:text-primary hover:bg-primary/10"
          >
            Practice again tomorrow
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
