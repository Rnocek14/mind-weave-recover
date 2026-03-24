import { memo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, Brain, Play, Gamepad2, Plus, AlertCircle,
  ClipboardList, Clock, Lightbulb,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useNavigate, useLocation } from "react-router-dom";
import { currentRoute, withReturnTo } from "@/lib/navigation";
import { useUiMode } from "@/hooks/useUiMode";
import { useProfile } from "@/hooks/useProfile";
import { useDoseLogs } from "@/hooks/useDoseLogs";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { TodaysPlanCard } from "@/components/TodaysPlanCard";
import { DoseLogEntry } from "@/components/DoseLogEntry";
import { GamePickerDialog } from "@/components/GamePickerDialog";
import { CapabilityGatingInfo } from "@/components/CapabilityGatingInfo";
import { WhatsAffectedCard } from "@/components/WhatsAffectedCard";
import { RecoveryFocusSummary } from "@/components/RecoveryFocusSummary";
import { StrengthsAndFocusAreasMap } from "@/components/clinician/StrengthsAndFocusAreasMap";
import { useStrengthsAndFocusAreas } from "@/hooks/useStrengthsAndFocusAreas";
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";
import { FunctionalGoalsWidget } from "@/components/FunctionalGoalsWidget";
import { RecentSessionsSummary } from "@/components/RecentSessionsSummary";
import { StandardizedAssessmentsCard } from "@/components/StandardizedAssessmentsCard";
import { CaregiverContextNotes } from "@/components/CaregiverContextNotes";
import { buildPresetLesson } from "@/lib/dailyLessonEngine";
import { toast } from "sonner";

export const PlanTab = memo(function PlanTab() {
  const {
    userId,
    clinicalProfile,
    lesson,
    todayFocus,
    doseCap,
    recommendations,
    recommendedExercises,
    checkExerciseAccess,
    getAdaptations,
    hasAssessment,
    hasSoftOverride,
    onStartAssessment,
  } = useDashboardContext();

  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = currentRoute(location);
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const { domains, todayLogs, isSaving: doseSaving, upsertDoseLog } = useDoseLogs(profileId, 7);
  const [showGamePicker, setShowGamePicker] = useState(false);
  
  const activeExerciseSlugs = lesson?.blocks?.map((b: any) => b.exerciseId) || recommendedExercises?.map((e: any) => e.id) || [];
  
  const { strengths, focusAreas, planSummary } = useStrengthsAndFocusAreas({
    clinicalProfile: clinicalProfile || null,
    runtimeConfig: (activeProfile as any)?.runtime_config || null,
    activeExerciseSlugs,
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Plan Rationale — why today's focus */}
      {todayFocus && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Today's Focus Rationale
          </h4>
          {todayFocus.reasoning && todayFocus.reasoning.length > 0 ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              {todayFocus.reasoning.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Plan generated based on your recovery profile and recent performance.
            </p>
          )}
        </Card>
      )}

      {/* Dosing & Tolerance Guidance */}
      {doseCap && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Dosing Guidance
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Today</p>
              <p className="font-medium tabular-nums">
                {doseCap.todayMinutes} / {doseCap.dailyCapMinutes} min
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Session cap</p>
              <p className="font-medium tabular-nums">
                {doseCap.sessionCapMinutes ?? 30} min
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge
                variant={
                  doseCap.warningLevel === "safe"
                    ? "default"
                    : doseCap.warningLevel === "limit"
                    ? "destructive"
                    : "secondary"
                }
                className="text-xs"
              >
                {doseCap.warningLevel === "safe"
                  ? "Ready"
                  : doseCap.warningLevel === "limit"
                  ? "Goal reached"
                  : `${doseCap.minutesRemaining}min left`}
              </Badge>
            </div>
            {doseCap.enforceCaps && (
              <div>
                <p className="text-muted-foreground text-xs">Caps</p>
                <Badge variant="outline" className="text-xs">
                  Enforced
                </Badge>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Today's Plan — primary action */}
      {!isClinician && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Today's Plan
          </h3>
          {lesson ? (
            <div className="space-y-4">
              <TodaysPlanCard
                userId={userId}
                clinicalProfile={clinicalProfile}
                onStartAssessment={onStartAssessment}
                onStartLesson={() => {
                  navigate("/lesson", { state: { lesson, clinicalProfile, todayFocus } });
                }}
                onStartComprehensionSession={() => {
                  const presetLesson = buildPresetLesson("comprehension_session");
                  if (presetLesson) {
                    navigate("/lesson", { state: { lesson: presetLesson, clinicalProfile, todayFocus } });
                  } else {
                    toast.error("Comprehension Session unavailable (missing exercises)");
                  }
                }}
                doseCapReached={doseCap.warningLevel === "limit"}
              />
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-gradient-healing hover:opacity-90 h-12"
                  onClick={() => navigate("/lesson", { state: { lesson, clinicalProfile } })}
                  disabled={doseCap.warningLevel === "limit"}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Session
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setShowGamePicker(true)}
                  disabled={doseCap.warningLevel === "limit"}
                >
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Choose a Game
                </Button>
              </div>
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No lesson generated yet. Complete an assessment to personalize your plan.</p>
              <Button className="mt-3" onClick={onStartAssessment}>
                <Brain className="w-4 h-4 mr-2" />
                Start Assessment
              </Button>
            </Card>
          )}
        </section>
      )}

      {/* Log Therapy */}
      {!isClinician && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Log Today's Therapy
          </h3>
          <DoseLogEntry
            domains={domains}
            todayLogs={todayLogs}
            onSubmit={upsertDoseLog}
            isSaving={doseSaving}
          />
        </section>
      )}

      {/* Recovery Focus Summary — bridges plan to outcomes */}
      {!isClinician && clinicalProfile && (
        <section>
          <RecoveryFocusSummary
            clinicalProfile={clinicalProfile}
            todayFocus={todayFocus}
            activeExerciseSlugs={lesson?.blocks?.map(b => b.exerciseId) || recommendedExercises?.map(e => e.id) || []}
          />
        </section>
      )}

      {/* What's Affected — caregiver-friendly brain map */}
      {!isClinician && clinicalProfile && (
        <section>
          <WhatsAffectedCard
            clinicalProfile={clinicalProfile}
            activeExerciseSlugs={lesson?.blocks?.map(b => b.exerciseId) || recommendedExercises?.map(e => e.id) || []}
          />
        </section>
      )}

      {/* Clinical Profile — clinician+ only (canonical home is Weekly Review) */}
      {isClinician && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Clinical Profile
          </h3>
          {clinicalProfile ? (
            <div className="space-y-6">
              <StrokeProfileSummary profile={clinicalProfile} />
              <BrainMap profile={{ clinical_profile: clinicalProfile }} userId={userId} />
              {(clinicalProfile as any).stroke_mechanism && (
                <MechanismSessionPlanner profile={clinicalProfile} />
              )}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No clinical profile set. Tap "Set Profile" in the header to personalize.
              </p>
            </Card>
          )}
        </section>
      )}

      {/* Goals & Sessions */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Goals & Sessions
        </h3>
        <div className="space-y-6">
          <FunctionalGoalsWidget userId={userId} compact={!isClinician} />
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Sessions
            </h4>
            <RecentSessionsSummary userId={userId} />
          </div>
          {isClinician && (
            <>
              <div className="border-t border-border pt-4">
                <StandardizedAssessmentsCard userId={userId} />
              </div>
              <div className="border-t border-border pt-4">
                <CaregiverContextNotes profileId={profileId} />
              </div>
            </>
          )}
        </div>
      </section>

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
