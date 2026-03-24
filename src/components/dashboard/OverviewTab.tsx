import { useState, memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Play, Brain, Gamepad2, Crosshair, Stethoscope, Battery,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { WeeklyDeltasCard } from "@/components/dashboard/WeeklyDeltasCard";
import { DomainConfidenceSummary } from "@/components/dashboard/DomainConfidenceSummary";
import { CaregiverTodayCard } from "@/components/CaregiverTodayCard";
import { useUiMode } from "@/hooks/useUiMode";
import { useProfile } from "@/hooks/useProfile";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { ReadinessStatusCard } from "@/components/ReadinessStatusCard";
import { DailyReadinessCheckin } from "@/components/DailyReadinessCheckin";
import { GamePickerDialog } from "@/components/GamePickerDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { RedFlagAlerts } from "@/components/RedFlagAlerts";
import { ClinicianPatientHeader } from "@/components/ClinicianPatientHeader";
import { InsightsCTACard } from "@/components/dashboard/InsightsCTACard";
import { useDashboardContext } from "@/hooks/useDashboardContext";

export const OverviewTab = memo(function OverviewTab() {
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const isCaregiver = uiMode === "caregiver";
  const {
    userId,
    doseCap,
    redFlags,
    clinicalProfile,
    lesson,
    todayFocus,
    hasAssessment,
    onStartAssessment,
  } = useDashboardContext();
  const navigate = useNavigate();
  const location = useLocation();

  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const {
    todayCheckin,
    isLoading: readinessLoading,
    isSaving: readinessSaving,
    upsertReadiness,
  } = useDailyReadiness(profileId);
  const [showReadinessDialog, setShowReadinessDialog] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);

  // Targeted practice from navigation state
  const targetedPractice = location.state?.targetedPractice as {
    words?: string[];
    exerciseType?: string;
  } | undefined;

  const getTargetedPracticeRoute = () => {
    if (!targetedPractice?.words?.length) return null;
    const wordsParam = targetedPractice.words.join(",");
    switch (targetedPractice.exerciseType) {
      case "photo-naming":
        return `/exercise/photo-naming?targets=${wordsParam}&source=dashboard_continue`;
      case "semantic-features":
        return `/exercise/semantic-features?targets=${wordsParam}&source=dashboard_continue`;
      case "phonological":
        return `/exercise/phonological-awareness?targets=${wordsParam}&source=dashboard_continue`;
      default:
        return `/exercise/photo-naming?targets=${wordsParam}&source=dashboard_continue`;
    }
  };

  // Split flags
  const urgentFlags = redFlags.filter(
    (f) => f.severity === "red" || f.severity === "orange"
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Clinician badge */}
      {isClinician && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Clinician View (read-only)
          </span>
        </div>
      )}

      {/* Clinician header */}
      {isClinician && <ClinicianPatientHeader />}

      {/* Urgent red flags */}
      {urgentFlags.length > 0 && <RedFlagAlerts flags={urgentFlags} />}

      {/* Patient/Caregiver primary action */}
      {!isClinician && (
        <>
          {isCaregiver && <CaregiverTodayCard />}

          {/* Readiness */}
          <ReadinessStatusCard
            checkin={todayCheckin}
            onCheckIn={() => setShowReadinessDialog(true)}
            isLoading={readinessLoading}
          />
          <Dialog
            open={showReadinessDialog}
            onOpenChange={setShowReadinessDialog}
          >
            <DialogContent className="max-w-lg p-0 border-0 bg-transparent shadow-none">
              <DailyReadinessCheckin
                onSubmit={async (data) => {
                  const result = await upsertReadiness(data);
                  if (result) setShowReadinessDialog(false);
                  return result;
                }}
                onSkip={() => setShowReadinessDialog(false)}
                isSaving={readinessSaving}
              />
            </DialogContent>
          </Dialog>

          {/* Start Session CTA */}
          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Ready to Practice?</h2>
                {doseCap.warningLevel !== "safe" && doseCap.enforceCaps && (
                  <Badge variant="secondary" className="gap-1">
                    {doseCap.minutesRemaining > 0
                      ? `${doseCap.minutesRemaining}min left`
                      : "Goal reached!"}
                  </Badge>
                )}
              </div>

              {targetedPractice?.words?.length &&
                getTargetedPracticeRoute() && (
                  <Button
                    size="lg"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-lg h-14"
                    onClick={() => navigate(getTargetedPracticeRoute()!)}
                    disabled={doseCap.warningLevel === "limit"}
                  >
                    <Crosshair className="w-6 h-6 mr-2" />
                    Continue Targeted Practice (
                    {targetedPractice.words.length} words)
                  </Button>
                )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-healing hover:opacity-90 text-lg h-14"
                   onClick={() => {
                    if (lesson) {
                      const { trackSessionStartTap } = require('@/lib/sessionFlowAnalytics');
                      trackSessionStartTap(null, lesson.blocks?.length || 0);
                      navigate("/lesson", {
                        state: { lesson, clinicalProfile },
                      });
                    }
                  }}
                  disabled={!lesson || doseCap.warningLevel === "limit"}
                >
                  <Play className="w-6 h-6 mr-2" />
                  Start Today's Session
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 h-14"
                  onClick={() => setShowGamePicker(true)}
                  disabled={false}
                >
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Choose a Game
                </Button>
              </div>

              {!hasAssessment && (
                <Button
                  variant="ghost"
                  className="w-full text-primary"
                  onClick={onStartAssessment}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Complete quick assessment to personalize exercises
                </Button>
              )}

              {doseCap.warningLevel !== "safe" &&
                doseCap.warningLevel !== "limit" &&
                doseCap.enforceCaps && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Today's progress</span>
                      <span>
                        {doseCap.todayMinutes} / {doseCap.dailyCapMinutes} min
                      </span>
                    </div>
                    <Progress
                      value={
                        (doseCap.todayMinutes / doseCap.dailyCapMinutes) * 100
                      }
                      className="h-2"
                    />
                  </div>
                )}
            </div>
          </Card>
        </>
      )}

      {/* What Changed This Week */}
      <WeeklyDeltasCard />

      {/* Domain Confidence Summary — clinician+ only */}
      {isClinician && <DomainConfidenceSummary />}

      {/* Insights CTA */}
      {!isClinician && <InsightsCTACard />}

      {/* Game Picker */}
      {!isClinician && (
        <GamePickerDialog
          open={showGamePicker}
          onOpenChange={setShowGamePicker}
          userId={userId}
        />
      )}
    </div>
  );
});
