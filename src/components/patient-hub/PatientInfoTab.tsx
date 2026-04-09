/**
 * Patient Info Tab — Clinical context, goals, readiness, overrides, alerts.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, Heart, AlertTriangle, Shield
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useFunctionalGoals } from "@/hooks/useFunctionalGoals";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useClinicianOverrides } from "@/hooks/useClinicianOverrides";
import { ProfileSummaryCard } from "@/components/clinician/ProfileSummaryCard";

interface PatientInfoTabProps {
  userId: string;
  profileId: string | undefined;
}

function deriveSpeechLabel(cp: Record<string, any> | null): string | null {
  if (!cp) return null;
  const speech: string[] = cp?.impairments?.speech || [];
  const n = speech.map((s) => s.toLowerCase().replace(/[^a-z]/g, ""));
  if (n.some((s) => s.includes("broca") || s === "expressive")) return "Expressive aphasia";
  if (n.some((s) => s.includes("wernicke") || s === "receptive")) return "Receptive aphasia";
  if (n.some((s) => s.includes("global"))) return "Global aphasia";
  if (n.some((s) => s.includes("anomic"))) return "Anomic aphasia";
  if (speech.length > 0) return speech[0].replace(/_/g, " ");
  return null;
}

export function PatientInfoTab({ userId, profileId }: PatientInfoTabProps) {
  const { activeProfile } = useProfile();
  const { goals, loading: goalsLoading } = useFunctionalGoals(userId);
  const { todayCheckin } = useDailyReadiness(profileId);
  const { activeOverrides } = useClinicianOverrides(profileId);

  const clinicalProfile = activeProfile?.clinical_profile as Record<string, any> | null;
  const strokeDate = activeProfile?.stroke_date ?? null;
  const daysPostOnset = strokeDate
    ? Math.floor((Date.now() - new Date(strokeDate).getTime()) / 86_400_000)
    : null;
  const speechLabel = deriveSpeechLabel(clinicalProfile);

  return (
    <div className="space-y-4 mt-4">
      {/* Clinical Profile */}
      <ProfileSummaryCard
        clinicalProfile={clinicalProfile}
        strokeDate={strokeDate}
        daysPostOnset={daysPostOnset}
        profileName={activeProfile?.profile_name || "Patient"}
        speechLabel={speechLabel}
      />

      {/* Functional Goals */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Functional Goals
            {goals && <Badge variant="secondary" className="text-[10px]">{goals.filter((g) => !g.archived_at).length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          {goalsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : goals && goals.filter((g) => !g.archived_at).length > 0 ? (
            <div className="space-y-2">
              {goals.filter((g) => !g.archived_at).map((goal) => (
                <div key={goal.id} className="p-2 rounded bg-muted/30 text-sm">
                  <p className="font-medium">{goal.goal_text}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{goal.target_domain?.replace(/_/g, " ")}</Badge>
                    <span>Baseline: {goal.baseline_status}</span>
                    {goal.target_date && <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active goals set.</p>
          )}
        </CardContent>
      </Card>

      {/* Daily Readiness */}
      {todayCheckin && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              Today's Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <div className="text-lg font-bold">{todayCheckin.fatigue_rating}/5</div>
                <div className="text-muted-foreground">Fatigue</div>
              </div>
              {todayCheckin.mood_rating != null && (
                <div>
                  <div className="text-lg font-bold">{todayCheckin.mood_rating}/5</div>
                  <div className="text-muted-foreground">Mood</div>
                </div>
              )}
              {todayCheckin.sleep_quality != null && (
                <div>
                  <div className="text-lg font-bold">{todayCheckin.sleep_quality}/5</div>
                  <div className="text-muted-foreground">Sleep</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Overrides */}
      {activeOverrides.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Active Overrides
              <Badge variant="secondary" className="text-[10px]">{activeOverrides.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-2">
              {activeOverrides.map((o) => (
                <div key={o.id} className="p-2 rounded bg-muted/30 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{o.overrideType.replace(/_/g, " ")}</span>
                    {o.targetSlug && <Badge variant="outline" className="text-[10px]">{o.targetSlug.replace(/-/g, " ")}</Badge>}
                  </div>
                  {o.reason && <p className="text-muted-foreground mt-0.5">{o.reason}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
