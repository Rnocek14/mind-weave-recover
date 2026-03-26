/**
 * Caregiver Reassurance Card — validates the caregiver's effort.
 * 
 * Most rehab apps only track the patient. This card acknowledges 
 * that caregiving is hard work too.
 */

import { Card } from "@/components/ui/card";
import { Sparkles, Heart, Shield } from "lucide-react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useMemo } from "react";

interface CaregiverReassuranceCardProps {
  userId: string;
  patientName: string;
  streak: number;
}

function getReassuranceMessage(
  sessionsThisWeek: number,
  streak: number,
  hasAlerts: boolean,
  patientName: string,
): { message: string; subtext: string; icon: typeof Heart } {
  // Priority: alerts → low engagement → good progress
  if (hasAlerts) {
    return {
      message: "You're staying on top of things",
      subtext: `Checking in when there are concerns shows how much you care. ${patientName} is lucky to have you.`,
      icon: Shield,
    };
  }

  if (sessionsThisWeek === 0) {
    return {
      message: "Recovery isn't always linear",
      subtext: `Rest days are part of the process too. When ${patientName} is ready, even a short session helps.`,
      icon: Heart,
    };
  }

  if (streak >= 5) {
    return {
      message: "This consistency is making a difference",
      subtext: `${streak} days in a row doesn't happen without support. Your encouragement is part of ${patientName}'s progress.`,
      icon: Sparkles,
    };
  }

  if (sessionsThisWeek >= 3) {
    return {
      message: "You're doing a great job supporting them",
      subtext: `${sessionsThisWeek} sessions this week — that's real momentum. Keep it up.`,
      icon: Sparkles,
    };
  }

  return {
    message: "Every session counts",
    subtext: `Recovery is built one day at a time. Your presence and patience make a bigger difference than you know.`,
    icon: Heart,
  };
}

export function CaregiverReassuranceCard({
  userId,
  patientName,
  streak,
}: CaregiverReassuranceCardProps) {
  const { sessions } = useSessionHistory(userId);
  const { flags } = useRedFlagDetection(userId);

  const sessionsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return sessions.filter((s) => new Date(s.startedAt).getTime() > weekAgo).length;
  }, [sessions]);

  const hasAlerts = flags.some(
    (f) => f.severity === "red" || f.severity === "orange"
  );

  const { message, subtext, icon: Icon } = getReassuranceMessage(
    sessionsThisWeek,
    streak,
    hasAlerts,
    patientName,
  );

  return (
    <Card className="p-5 border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{message}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{subtext}</p>
        </div>
      </div>
    </Card>
  );
}
