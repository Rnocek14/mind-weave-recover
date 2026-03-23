/**
 * Actionable Next Steps — each recommendation has a quick-action button
 * that writes REAL state changes to the database.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle, TrendingUp, Flame, Heart, Lightbulb, Zap, Target,
  HelpCircle, CheckCircle, MessageSquare, SlidersHorizontal, ClipboardList,
  Phone, ArrowDown, ArrowUp, Loader2
} from "lucide-react";
import { HelpLabel } from "@/components/HelpTooltip";
import { toast } from "sonner";
import type { NextAction } from "@/lib/generateNextActions";
import {
  reduceDose, scheduleOutreach, adjustDifficulty,
  assignPractice, reviewCueing, type QuickActionResult
} from "@/lib/clinicianQuickActions";

interface ActionableNextStepsProps {
  actions: NextAction[];
  profileName: string;
  /** Required for DB writes */
  userId?: string;
  profileId?: string;
  clinicianId?: string;
  onCopyToNote?: (text: string) => void;
  /** Called after any DB action succeeds so parent can refetch */
  onActionComplete?: () => void;
}

const actionIconMap: Record<string, any> = {
  alert: AlertTriangle,
  trending: TrendingUp,
  fatigue: Flame,
  outreach: Heart,
  cue: Lightbulb,
  difficulty: Zap,
  practice: Target,
};

interface QuickAction {
  label: string;
  icon: any;
  action: string;
  /** If true, this action writes to DB (not just clipboard) */
  isDbAction?: boolean;
}

function getQuickActions(actionId: string): QuickAction[] {
  switch (actionId) {
    case "critical-alerts":
      return [
        { label: "Review Alerts", icon: AlertTriangle, action: "review_alerts" },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    case "engagement-gap":
      return [
        { label: "Schedule Call", icon: Phone, action: "schedule_outreach", isDbAction: true },
        { label: "Send Message", icon: MessageSquare, action: "send_message" },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    case "fatigue-monitoring":
      return [
        { label: "Reduce Dose", icon: ArrowDown, action: "reduce_dose", isDbAction: true },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    case "accuracy-decline":
      return [
        { label: "Lower Difficulty", icon: ArrowDown, action: "lower_difficulty", isDbAction: true },
        { label: "Review Cueing", icon: SlidersHorizontal, action: "review_cueing", isDbAction: true },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    case "increase-difficulty":
      return [
        { label: "Increase Difficulty", icon: ArrowUp, action: "increase_difficulty", isDbAction: true },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    case "low-practice":
      return [
        { label: "Assign Practice", icon: Target, action: "assign_practice", isDbAction: true },
        { label: "Schedule Call", icon: Phone, action: "schedule_outreach", isDbAction: true },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    case "positive-trend":
      return [
        { label: "Maintain Plan", icon: CheckCircle, action: "maintain" },
        { label: "Add to Note", icon: ClipboardList, action: "add_note" },
      ];
    default:
      return [{ label: "Add to Note", icon: ClipboardList, action: "add_note" }];
  }
}

export function ActionableNextSteps({
  actions, profileName, userId, profileId, clinicianId, onCopyToNote
}: ActionableNextStepsProps) {
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (actions.length === 0) return null;

  const canDoDbActions = !!(userId && profileId && clinicianId);
  const ctx = canDoDbActions ? { userId: userId!, profileId: profileId!, clinicianId: clinicianId! } : null;

  const handleQuickAction = async (action: NextAction, quickAction: QuickAction) => {
    const noteText = `[${new Date().toLocaleDateString()}] ${action.title}: ${action.detail}`;
    const actionKey = `${action.id}-${quickAction.action}`;

    // DB actions
    if (quickAction.isDbAction && ctx) {
      setLoadingAction(actionKey);
      let result: QuickActionResult | null = null;

      try {
        switch (quickAction.action) {
          case "schedule_outreach":
            result = await scheduleOutreach(ctx, action.detail);
            break;
          case "reduce_dose":
            result = await reduceDose(ctx);
            break;
          case "lower_difficulty":
            result = await adjustDifficulty(ctx, "decrease");
            break;
          case "increase_difficulty":
            result = await adjustDifficulty(ctx, "increase");
            break;
          case "assign_practice":
            result = await assignPractice(ctx, action.detail);
            break;
          case "review_cueing":
            result = await reviewCueing(ctx);
            break;
        }

        if (result?.success) {
          toast.success(result.message);
        } else {
          toast.error(result?.message || "Action failed");
        }
      } catch (err) {
        toast.error("Failed to execute action");
      } finally {
        setLoadingAction(null);
      }

      if (result?.success) {
        setCompletedActions((prev) => new Set(prev).add(actionKey));
      }
      return;
    }

    // Non-DB actions (clipboard, navigation, etc.)
    switch (quickAction.action) {
      case "add_note":
        if (onCopyToNote) {
          onCopyToNote(noteText);
        } else {
          navigator.clipboard.writeText(noteText);
          toast.success("Copied to clipboard — paste into your session note");
        }
        break;
      case "send_message":
        navigator.clipboard.writeText(
          `Hi — checking in on your practice this week. Let us know if you need any support or have questions about your exercises.`
        );
        toast.success("Message template copied to clipboard");
        break;
      case "review_alerts":
        toast.info("Scroll up to the Alerts section to review and acknowledge");
        break;
      case "maintain":
        toast.success("Current plan maintained — no changes needed");
        break;
      // Fallback for DB actions without context
      default:
        if (quickAction.isDbAction && !ctx) {
          toast.info(`${quickAction.label}: sign in as clinician to perform this action`);
        }
        break;
    }

    setCompletedActions((prev) => new Set(prev).add(actionKey));
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <HelpLabel term="Recommended Actions">Recommended Next Actions</HelpLabel>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p>
                  Rule-based clinical suggestions derived from this period's telemetry.
                  Actions with a ⚡ icon write directly to the patient's care plan
                  (dose targets, alerts, adaptation log). All changes are logged
                  for audit. Non-⚡ actions copy text to clipboard.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        {actions.map((action) => {
          const Icon = actionIconMap[action.icon] || HelpCircle;
          const quickActions = getQuickActions(action.id);
          return (
            <div key={action.id} className="rounded-lg bg-muted/30 p-3 space-y-2">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${
                  action.priority === "high" ? "text-red-500" :
                  action.priority === "medium" ? "text-amber-500" : "text-green-500"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{action.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        action.priority === "high" ? "border-red-300 text-red-600" :
                        action.priority === "medium" ? "border-amber-300 text-amber-600" :
                        "border-green-300 text-green-600"
                      }`}
                    >
                      {action.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.detail}</p>
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-1.5 pl-7">
                {quickActions.map((qa) => {
                  const isCompleted = completedActions.has(`${action.id}-${qa.action}`);
                  const isLoading = loadingAction === `${action.id}-${qa.action}`;
                  const QaIcon = qa.icon;
                  return (
                    <Button
                      key={qa.action}
                      size="sm"
                      variant={isCompleted ? "default" : "outline"}
                      className={`h-7 text-[11px] gap-1 ${isCompleted ? "opacity-70" : ""}`}
                      onClick={() => handleQuickAction(action, qa)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <QaIcon className="w-3 h-3" />
                      )}
                      {qa.isDbAction && !isCompleted && <Zap className="w-2 h-2" />}
                      {qa.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
