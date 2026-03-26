import { Card } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, TrendingDown, Clock, Heart, Lightbulb, Sun, Moon, Sunset } from "lucide-react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useProfile } from "@/hooks/useProfile";
import { useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";

interface CaregiverStatusHeroProps {
  userId: string;
  streak: number;
  patientName?: string;
}

function getTimeGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", icon: Sun };
  if (hour < 17) return { text: "Good afternoon", icon: Sunset };
  return { text: "Good evening", icon: Moon };
}

type OverallStatus = "good" | "needs-support" | "concern";

function getOverallStatus(
  streak: number,
  recentSessionCount: number,
  redFlagCount: number,
  fatigue: number | null
): { status: OverallStatus; label: string; description: string; color: string } {
  if (redFlagCount > 0) {
    return {
      status: "concern",
      label: "Needs Attention",
      description: "There are alerts that need your review",
      color: "border-destructive/30 bg-destructive/5",
    };
  }
  if (recentSessionCount < 2 || (fatigue !== null && fatigue >= 4)) {
    return {
      status: "needs-support",
      label: "Needs Support",
      description: fatigue !== null && fatigue >= 4
        ? "They reported high fatigue — shorter sessions may help"
        : "Practice has been low this week — gentle encouragement may help",
      color: "border-amber-500/30 bg-amber-500/5",
    };
  }
  return {
    status: "good",
    label: "Doing Well",
    description: `${streak > 0 ? `${streak}-day streak! ` : ""}Practice is on track`,
    color: "border-emerald-500/30 bg-emerald-500/5",
  };
}

/**
 * Above-the-fold status hero for caregiver dashboard.
 * Answers "How are they doing?" in <5 seconds.
 */
export function CaregiverStatusHero({ userId, streak, patientName }: CaregiverStatusHeroProps) {
  const { sessions } = useSessionHistory(userId);
  const { flags } = useRedFlagDetection(userId);
  const { activeProfile } = useProfile();
  const { todayCheckin } = useDailyReadiness(activeProfile?.id || "");

  const recentSessionCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return sessions.filter((s) => new Date(s.startedAt).getTime() > weekAgo).length;
  }, [sessions]);

  const lastSession = sessions[0];
  const lastSessionLabel = lastSession?.startedAt
    ? (() => {
        const days = differenceInDays(new Date(), parseISO(lastSession.startedAt));
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        return format(parseISO(lastSession.startedAt), "EEE, MMM d");
      })()
    : "No sessions yet";

  const overall = getOverallStatus(
    streak,
    recentSessionCount,
    flags.length,
    todayCheckin?.fatigue_rating ?? null
  );

  const StatusIcon = overall.status === "good"
    ? CheckCircle
    : overall.status === "concern"
    ? AlertTriangle
    : TrendingDown;

  return (
    <Card className={`p-5 border-2 ${overall.color}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
          overall.status === "good" ? "bg-emerald-100 text-emerald-600" :
          overall.status === "concern" ? "bg-destructive/10 text-destructive" :
          "bg-amber-100 text-amber-600"
        }`}>
          <StatusIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-xl font-bold text-foreground">{overall.label}</h2>
          <p className="text-sm text-muted-foreground">{overall.description}</p>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{recentSessionCount}</div>
          <div className="text-xs text-muted-foreground">Sessions this week</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{streak}</div>
          <div className="text-xs text-muted-foreground">Day streak</div>
        </div>
        <div className="text-center">
          <Clock className="w-4 h-4 mx-auto mb-0.5 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">{lastSessionLabel}</div>
        </div>
      </div>
    </Card>
  );
}

/**
 * "How You Can Help" card with actionable, non-clinical suggestions.
 */
export function HowYouCanHelpCard({ userId }: { userId: string }) {
  const { flags } = useRedFlagDetection(userId);
  const { sessions } = useSessionHistory(userId);
  const { activeProfile } = useProfile();
  const { todayCheckin } = useDailyReadiness(activeProfile?.id || "");

  const tips = useMemo(() => {
    const result: Array<{ text: string; icon: typeof Heart }> = [];

    // Fatigue-based tips
    if (todayCheckin?.fatigue_rating && todayCheckin.fatigue_rating >= 4) {
      result.push({ text: "They're feeling tired today — suggest a short, easy session or rest", icon: Heart });
    }

    // Engagement-based tips
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recentCount = sessions.filter((s) => new Date(s.startedAt).getTime() > weekAgo).length;
    if (recentCount < 2) {
      result.push({ text: "Gently encourage them to try a session — even 5 minutes helps", icon: Lightbulb });
    }

    // Alert-based tips
    if (flags.some((f) => f.severity === "red" || f.severity === "orange")) {
      result.push({ text: "There are some concerns to review — you may want to contact their therapist", icon: AlertTriangle });
    }

    // Default positive tips
    if (result.length === 0) {
      result.push({ text: "Celebrate their progress — positive reinforcement helps recovery", icon: Heart });
      result.push({ text: "Practice together — you can sit with them during a session", icon: Lightbulb });
    }

    return result.slice(0, 3);
  }, [todayCheckin, sessions, flags]);

  return (
    <Card className="p-5 border-2 space-y-3">
      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Heart className="w-5 h-5 text-pink-500" />
        How You Can Help
      </h3>
      <div className="space-y-2.5">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{tip.text}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
