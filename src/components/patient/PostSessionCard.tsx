import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TrendingUp, Clock, Flame, X, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXERCISE_DOMAIN_MAP } from "@/lib/exerciseDomainLookup";
import type { LastSessionFeedback } from "@/hooks/useLastSessionFeedback";
import { generateAnticipation, type MayaDomainInput } from "@/lib/mayaNarrative";

interface PostSessionCardProps {
  feedback: LastSessionFeedback;
  onDismiss: () => void;
  onStartSession?: () => void;
  anticipation?: string | null;
}

const DOMAIN_LABELS: Record<string, string> = {
  lexical_retrieval: "word finding",
  semantic_depth: "meaning & categories",
  executive_function: "thinking & planning",
  syntax: "sentence building",
  phonology: "sounds & pronunciation",
  discourse_organization: "conversation",
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
  const { accuracy, correctDelta, streak, independentCorrect } = feedback;
  if (accuracy >= 90) return { text: "Amazing work!", emoji: "🎉" };
  if (independentCorrect >= 5) return { text: "So many on your own!", emoji: "⭐" };
  if (accuracy >= 75) return { text: "Great session!", emoji: "💪" };
  if (correctDelta > 0) return { text: "You're improving!", emoji: "📈" };
  if (streak >= 3) return { text: "Consistency pays off!", emoji: "🔥" };
  return { text: "You showed up — that matters!", emoji: "💛" };
}

function getMotivationalNudge(feedback: LastSessionFeedback, domainLabel: string | null): string {
  const { streak, correctDelta, independentCorrect, accuracy } = feedback;

  if (independentCorrect >= 3 && domainLabel) {
    return `${independentCorrect} answers without any help in ${domainLabel} — that's real progress! 🌟`;
  }
  if (streak >= 5) return `${streak} days in a row — you're building a powerful habit! 🔥`;
  if (streak >= 3) return `${streak} days in a row — keep the momentum going!`;
  if (correctDelta > 0) return `${correctDelta} more correct than last time — you're getting stronger! 📈`;
  if (accuracy >= 80 && domainLabel) return `Strong work on ${domainLabel} today!`;
  return "Every session builds stronger connections 🧠";
}

export function PostSessionCard({ feedback, onDismiss, onStartSession, anticipation }: PostSessionCardProps) {
  const [minimized, setMinimized] = useState(false);
  const { text, emoji } = getHeadline(feedback);
  const domainLabel = getDomainLabel(feedback.exerciseNames);

  const handleDismiss = () => {
    setMinimized(true);
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
              You worked on {domainLabel} today
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className={cn(
          "grid gap-3",
          feedback.independentCorrect > 0 ? "grid-cols-4" : "grid-cols-3"
        )}>
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

          {/* Independent answers — only if > 0 */}
          {feedback.independentCorrect > 0 && (
            <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Star className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-lg font-bold text-foreground">
                {feedback.independentCorrect}
              </p>
              <p className="text-xs text-muted-foreground">On your own</p>
            </div>
          )}

          {/* Streak or delta */}
          <div className="text-center p-3 rounded-xl bg-accent/30 border border-accent/40">
            {feedback.correctDelta > 0 ? (
              <>
                <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">
                  +{feedback.correctDelta}
                </p>
                <p className="text-xs text-muted-foreground">vs last time</p>
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

        {/* Motivational nudge — now domain-aware */}
        <p className="text-sm text-center text-muted-foreground">
          {getMotivationalNudge(feedback, domainLabel)}
        </p>

        {/* Forward-looking anticipation */}
        {anticipation && (
          <p className="text-xs text-center text-muted-foreground/80 italic">
            ✨ {anticipation}
          </p>
        )}

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
