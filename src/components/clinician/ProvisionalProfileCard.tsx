/**
 * ProvisionalProfileCard
 *
 * Surfaces an ONBOARDING-generated provisional "therapy personalization profile"
 * to the clinician in the Decide / Patient Info view. This is patient-reported,
 * NOT clinician-confirmed — it exists only so new users don't run on dark
 * defaults. The clinician is the source of truth and can confirm it (elevating
 * confidence + clearing the provisional flag) or supersede it via the full
 * profile editor.
 *
 * It only renders when the active clinical profile's provenance is 'onboarding'.
 * Once confirmed/superseded, provenance changes and this card disappears.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Brain,
  Target,
  CheckCircle2,
  ShieldQuestion,
  Info,
} from "lucide-react";
import { useClinicalProfileVersions } from "@/hooks/useClinicalProfileVersions";
import type { FunctionalGoal } from "@/hooks/useFunctionalGoals";

interface ProvisionalProfileCardProps {
  userId: string;
  clinicalProfile: Record<string, any> | null;
  goals?: FunctionalGoal[];
  /** Called after a successful confirm so the parent can refetch the profile. */
  onConfirmed?: () => void;
}

function titleCase(s: unknown): string {
  const str = typeof s === "string" ? s : String(s ?? "");
  return str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Onboarding stores the provisional flag in extraction_metadata.provenance. */
function isOnboardingProvisional(cp: Record<string, any> | null): boolean {
  if (!cp || typeof cp !== "object") return false;
  return cp?.extraction_metadata?.provenance === "onboarding";
}

export function ProvisionalProfileCard({
  userId,
  clinicalProfile,
  goals = [],
  onConfirmed,
}: ProvisionalProfileCardProps) {
  const { createVersion, isLoading } = useClinicalProfileVersions(userId);
  const [confirmed, setConfirmed] = useState(false);

  const isProvisional = useMemo(
    () => isOnboardingProvisional(clinicalProfile),
    [clinicalProfile],
  );

  if (!isProvisional || confirmed) return null;

  const cp = clinicalProfile as Record<string, any>;
  const speech: string[] = cp?.impairments?.speech || [];
  const motor: string[] = cp?.impairments?.motor || [];
  const cognitive: string[] = cp?.impairments?.cognitive || [];
  const therapyFocus: string[] = cp?.therapy_focus || [];
  const severity: Record<string, any> = cp?.severity || {};
  const confidence: string = cp?.confidence || "low";
  const meta = cp?.extraction_metadata || {};
  const severeMode: boolean = !!meta?.severe_aphasia_mode;
  const comprehensionSupport: boolean = !!meta?.comprehension_support;
  const energyLevel: string | null = meta?.energy_level || null;

  // Primary inferred aphasia type = first speech impairment string.
  const inferredType = speech[0] ? titleCase(speech[0].split("(")[0].trim()) : "Not specified";
  const activeGoals = goals.filter((g) => !g.archived_at);

  const handleConfirm = async () => {
    if (!clinicalProfile) return;
    // Elevate to a clinician-confirmed version: keep the clinical content, but
    // mark it clinician-authored and clear the onboarding provenance so this
    // card stops showing and the override hierarchy treats it as authoritative.
    const confirmedProfile = {
      ...clinicalProfile,
      profile_source: "clinician_override",
      confidence: "high",
      extraction_metadata: {
        ...(clinicalProfile as any).extraction_metadata,
        provenance: "clinician_confirmed",
        confirmed_at: new Date().toISOString(),
      },
    };
    delete (confirmedProfile as any).provisional;

    await createVersion(confirmedProfile, "clinician_override", {
      changeReason: "Clinician confirmed provisional onboarding profile",
      confidence: "high",
    });
    setConfirmed(true);
    onConfirmed?.();
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-amber-600" />
          Patient-Reported Personalization Profile
          <Badge variant="outline" className="text-xs h-5 ml-auto border-amber-500/50 text-amber-700">
            Not clinician-confirmed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Generated from the patient's onboarding answers to avoid default settings.
          Review and confirm, edit, or supersede — your profile remains the source of truth.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Source + confidence */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShieldQuestion className="w-3 h-3" /> Source &amp; Confidence
            </div>
            <div className="flex flex-wrap gap-1 pl-4">
              <Badge variant="secondary" className="text-xs h-5">Source: Onboarding</Badge>
              <Badge
                variant="outline"
                className="text-xs h-5 capitalize"
              >
                Confidence: {confidence}
              </Badge>
            </div>
          </div>

          {/* Inferred type */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Brain className="w-3 h-3" /> Inferred Type
            </div>
            <p className="text-xs pl-4 font-medium">{inferredType}</p>
          </div>

          {/* Severity */}
          {Object.keys(severity).length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Target className="w-3 h-3" /> Severity
              </div>
              <div className="space-y-0.5 text-xs pl-4">
                {Object.entries(severity).map(([k, v]) => (
                  <p key={k}>
                    <span className="text-muted-foreground capitalize">{k}:</span>{" "}
                    <span className="font-medium capitalize">{String(v)}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Affected domains */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Target className="w-3 h-3" /> Affected Domains
            </div>
            <div className="flex flex-wrap gap-1 pl-4">
              {[
                ...speech.map((s) => ({ d: "Speech", l: titleCase(s.split("(")[0].trim()) })),
                ...motor.map((s) => ({ d: "Motor", l: titleCase(s.split("(")[0].trim()) })),
                ...cognitive.map((s) => ({ d: "Cognitive", l: titleCase(s.split("(")[0].trim()) })),
              ].slice(0, 6).map((imp, i) => (
                <Badge key={i} variant="outline" className="text-xs h-5">
                  <span className="text-muted-foreground mr-1">{imp.d}:</span>
                  {imp.l}
                </Badge>
              ))}
              {therapyFocus.length === 0 && speech.length === 0 && motor.length === 0 && (
                <span className="text-xs text-muted-foreground italic">None reported</span>
              )}
            </div>
          </div>
        </div>

        {/* Support flags */}
        {(severeMode || comprehensionSupport || energyLevel) && (
          <div className="flex flex-wrap gap-1">
            {severeMode && (
              <Badge variant="destructive" className="text-xs h-5">Severe-aphasia mode</Badge>
            )}
            {comprehensionSupport && (
              <Badge variant="secondary" className="text-xs h-5">Comprehension support</Badge>
            )}
            {energyLevel && (
              <Badge variant="outline" className="text-xs h-5">Energy: {energyLevel}</Badge>
            )}
          </div>
        )}

        {/* Patient goals */}
        {activeGoals.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Patient Goals</div>
            <div className="flex flex-wrap gap-1">
              {activeGoals.slice(0, 5).map((g) => (
                <Badge key={g.id} variant="secondary" className="text-xs h-5">
                  {g.goal_text.length > 40 ? `${g.goal_text.slice(0, 40)}…` : g.goal_text}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {isLoading ? "Confirming…" : "Confirm as clinical profile"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            asChild
          >
            <a href="/dashboard?tab=clinical">Edit / Supersede</a>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Confirming marks this as clinician-authored with high confidence. To change details,
          use Edit / Supersede — clinician-authored profiles always override onboarding data.
        </p>
      </CardContent>
    </Card>
  );
}
