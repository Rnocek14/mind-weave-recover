/**
 * Caregiver Home — Unified status hub answering:
 * "Is everything okay?" and "How can I help?"
 *
 * Hierarchy: Status Hero → How to Help → Concerns → Adherence → Quick Actions
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Heart, HeartPulse, TrendingUp, Camera, FileText,
  History, Play, BarChart3, AlertTriangle, Calendar,
  Loader2, CheckCircle, Clock, Flame, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCaregiverAnalytics } from "@/hooks/useCaregiverAnalytics";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useWordMastery } from "@/hooks/useWordMastery";
import { calculateStreak } from "@/hooks/useStreakCalculation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// ── Status computation ──
type OverallStatus = "good" | "needs-support" | "concern";

function computeStatus(
  redFlagCount: number,
  sessionsThisWeek: number,
  streak: number,
): { status: OverallStatus; headline: string; subtext: string } {
  if (redFlagCount > 0) {
    return {
      status: "concern",
      headline: "Needs attention",
      subtext: `${redFlagCount} concern${redFlagCount > 1 ? "s" : ""} to review`,
    };
  }
  if (sessionsThisWeek === 0 && streak === 0) {
    return {
      status: "needs-support",
      headline: "Needs encouragement",
      subtext: "No practice sessions this week — a gentle reminder could help",
    };
  }
  if (sessionsThisWeek < 2) {
    return {
      status: "needs-support",
      headline: "Getting started",
      subtext: "A few sessions done — try to encourage daily practice",
    };
  }
  return {
    status: "good",
    headline: "Doing well",
    subtext: `${sessionsThisWeek} sessions this week — recovery is on track`,
  };
}

function getHelpTips(
  status: OverallStatus,
  streak: number,
  sessionsThisWeek: number,
  lastSessionDate: string | null,
): string[] {
  const tips: string[] = [];

  if (sessionsThisWeek === 0) {
    tips.push("Encourage them to try a short session — even 5 minutes helps");
  } else if (sessionsThisWeek < 3) {
    tips.push("Try to practice together — it makes sessions more enjoyable");
  }

  if (streak === 0) {
    tips.push("Help them start a practice streak — consistency matters more than intensity");
  } else if (streak >= 3) {
    tips.push(`They're on a ${streak}-day streak! Celebrate this milestone together`);
  }

  if (!lastSessionDate) {
    tips.push("Sit down together and explore the Practice tab to find exercises they enjoy");
  } else {
    tips.push("Ask what exercises they liked best — motivation drives recovery");
  }

  return tips.slice(0, 3);
}

const STATUS_STYLES: Record<OverallStatus, { bg: string; border: string; icon: typeof Heart; iconColor: string }> = {
  good: { bg: "bg-success/5", border: "border-success/20", icon: HeartPulse, iconColor: "text-success" },
  "needs-support": { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: Heart, iconColor: "text-amber-500" },
  concern: { bg: "bg-destructive/5", border: "border-destructive/20", icon: AlertTriangle, iconColor: "text-destructive" },
};

const Caregiver = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { summary, isLoading: analyticsLoading } = useCaregiverAnalytics(user?.id || null);
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  const { sessions } = useSessionHistory(user?.id || null);
  const { mastered } = useWordMastery(user?.id || null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      calculateStreak(user.id).then(setStreak).catch(() => {});
    }
  }, [user]);

  const isLoading = authLoading || analyticsLoading || flagsLoading;

  // Weekly session count
  const sessionsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return sessions.filter(s => new Date(s.startedAt).getTime() > weekAgo).length;
  }, [sessions]);

  const lastSession = sessions[0];
  const lastSessionDate = lastSession?.startedAt || null;

  const { status, headline, subtext } = useMemo(
    () => computeStatus(
      redFlags.filter(f => f.severity === "red").length,
      sessionsThisWeek,
      streak,
    ),
    [redFlags, sessionsThisWeek, streak],
  );

  const helpTips = useMemo(
    () => getHelpTips(status, streak, sessionsThisWeek, lastSessionDate),
    [status, streak, sessionsThisWeek, lastSessionDate],
  );

  const caregiverConcerns = useMemo(() => {
    return redFlags
      .filter(f => f.severity === "red" || f.severity === "orange")
      .slice(0, 3)
      .map(f => f.message);
  }, [redFlags]);

  const statusStyle = STATUS_STYLES[status];
  const StatusIcon = statusStyle.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const patientName = activeProfile?.display_name || activeProfile?.profile_name || "your person";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-2xl px-4 py-6 space-y-5 animate-fade-in">

        {/* ═══ STATUS HERO ═══ */}
        <Card className={cn("p-6 border-2", statusStyle.bg, statusStyle.border)}>
          <div className="flex items-start gap-4">
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center shrink-0", statusStyle.bg)}>
              <StatusIcon className={cn("w-7 h-7", statusStyle.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{headline}</h1>
              <p className="text-base text-muted-foreground mt-1">{subtext}</p>
            </div>
          </div>

          {/* Key stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{sessionsThisWeek}</div>
              <div className="text-xs text-muted-foreground">Sessions this week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
                {streak}
                {streak >= 3 && <Flame className="w-5 h-5 text-amber-500" />}
              </div>
              <div className="text-xs text-muted-foreground">Day streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {lastSessionDate
                  ? formatDistanceToNow(new Date(lastSessionDate), { addSuffix: false })
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Since last session</div>
            </div>
          </div>
        </Card>

        {/* ═══ HOW YOU CAN HELP ═══ */}
        <Card className="p-5 border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-primary" />
            How You Can Help
          </h2>
          <div className="space-y-2">
            {helpTips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══ CONCERNS (conditional) ═══ */}
        {caregiverConcerns.length > 0 && (
          <Card className="p-5 border-2 border-amber-500/20 bg-amber-500/5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Things to Be Aware Of
            </h2>
            <div className="space-y-2">
              {caregiverConcerns.map((concern, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed">{concern}</p>
              ))}
            </div>
          </Card>
        )}

        {/* ═══ ADHERENCE SNAPSHOT ═══ */}
        <Card className="p-5 border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            Practice Summary
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-foreground">{summary?.totalSessions || 0}</div>
              <div className="text-xs text-muted-foreground">Total sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{summary?.totalMinutes || 0}m</div>
              <div className="text-xs text-muted-foreground">Practice time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{mastered}</div>
              <div className="text-xs text-muted-foreground">Words mastered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {summary?.avgAccuracy ? `${Math.round(summary.avgAccuracy)}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg accuracy</div>
            </div>
          </div>
        </Card>

        {/* ═══ QUICK ACTIONS ═══ */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground px-1">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 border-2"
              onClick={() => navigate("/dashboard")}
            >
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">View Progress</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 border-2"
              onClick={() => navigate("/photo-library")}
            >
              <Camera className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Photo Library</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 border-2"
              onClick={() => navigate("/clinical-documents")}
            >
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Medical Docs</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 border-2"
              onClick={() => navigate("/profile-history")}
            >
              <History className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Profile History</span>
            </Button>
          </div>
        </div>

        {/* Recent session hint */}
        {lastSession && (
          <Card className="p-4 border bg-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Last session</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lastSession.startedAt), "EEEE, MMM d 'at' h:mm a")}
                    {lastSession.durationSec && ` · ${Math.round(lastSession.durationSec / 60)} min`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="text-xs">
                History <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Caregiver;
