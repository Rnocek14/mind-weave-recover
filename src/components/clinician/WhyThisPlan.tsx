/**
 * "Why This Plan" — Traceability card showing how the clinical profile
 * drives exercise selection, cue level, difficulty, and recent adjustments.
 * 
 * Now includes: Recovery Focus Summary, Strengths & Focus Areas Map,
 * Therapy Focus Map, live config state, active overrides, and coverage gaps.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, ArrowRight, Brain, Target, Volume2, SlidersHorizontal, Zap, User, Bot, Undo2 } from "lucide-react";
import { HelpLabel } from "@/components/HelpTooltip";
import { getExerciseDomain, type ExerciseDomainEntry } from "@/lib/exerciseDomainMap";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import { useTherapyFocusData } from "@/hooks/useTherapyFocusData";
import { useStrengthsAndFocusAreas } from "@/hooks/useStrengthsAndFocusAreas";
import { TherapyFocusMap } from "@/components/clinician/TherapyFocusMap";
import { StrengthsAndFocusAreasMap } from "@/components/clinician/StrengthsAndFocusAreasMap";
import type { ClinicianOverride } from "@/hooks/useClinicianOverrides";
import type { AdaptationEvent } from "@/hooks/useAdaptationTimeline";

interface WhyThisPlanProps {
  clinicalProfile: Record<string, any> | null;
  /** Runtime config (difficulty, cueing, practice) — separate from clinical profile */
  runtimeConfig?: Record<string, any> | null;
  activeExerciseSlugs: string[];
  recentAdaptations?: Array<{
    type: string;
    detail: string;
    date: string;
  }>;
  /** Active clinician overrides for live config display */
  activeOverrides?: ClinicianOverride[];
  /** Recent overrides (including reversed) for history */
  recentOverrides?: ClinicianOverride[];
  /** Callback to reverse an override */
  onReverseOverride?: (overrideId: string) => void;
  /** Adaptation events for therapy focus map */
  adaptationEvents?: AdaptationEvent[];
}

const overrideTypeLabels: Record<string, string> = {
  difficulty: "Difficulty",
  dose_reduction: "Dose",
  cue_level: "Cueing",
  practice_assignment: "Practice",
  outreach: "Outreach",
};

export function WhyThisPlan({
  clinicalProfile,
  runtimeConfig,
  activeExerciseSlugs,
  recentAdaptations,
  activeOverrides = [],
  recentOverrides = [],
  onReverseOverride,
  adaptationEvents = [],
}: WhyThisPlanProps) {
  const cp = clinicalProfile;
  const rc = runtimeConfig || {};
  const therapyFocus: string[] = cp?.therapy_focus || [];
  const speechImpairments: string[] = cp?.impairments?.speech || [];
  const cognitiveImpairments: string[] = cp?.impairments?.cognitive || [];

  // Live config from runtime_config (separate from clinical truth)
  const difficultyOverrides = rc?.difficulty_overrides || {};
  const globalDifficulty = difficultyOverrides._global ?? 0;
  const cueOverride = rc?.cue_level_override ?? null;
  const cueReviewedAt = rc?.cue_review_at ?? null;
  const practiceAssignments = rc?.practice_assignments || [];
  const activePractice = practiceAssignments.filter((a: any) => a.status === "active");

  // Map active exercises to their domain entries
  const activeEntries = useMemo(() => {
    return activeExerciseSlugs
      .map((slug) => getExerciseDomain(slug))
      .filter(Boolean) as ExerciseDomainEntry[];
  }, [activeExerciseSlugs]);

  // Which cognitive domains are being exercised
  const activeCognitiveDomains = useMemo(() => {
    const set = new Set<string>();
    activeEntries.forEach((e) => e.cognitiveDomains.forEach((d) => set.add(d)));
    return Array.from(set);
  }, [activeEntries]);

  // Which cognitive domains are NOT being exercised
  const missingDomains = useMemo(() => {
    const allDomains = COGNITIVE_DOMAINS
      .filter((d) => d.slug !== "cognitive_endurance")
      .map((d) => d.slug);
    return allDomains.filter((d) => !activeCognitiveDomains.includes(d));
  }, [activeCognitiveDomains]);

  // Therapy Focus Map data
  const { cardsByDomain, sessionRationale } = useTherapyFocusData({
    activeExerciseSlugs,
    clinicalProfile,
    runtimeConfig: runtimeConfig || null,
    adaptationEvents,
    activeOverrides,
  });

  if (activeExerciseSlugs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <HelpLabel term="Plan Traceability">Therapy Focus Map</HelpLabel>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p>
                  Shows why each exercise was selected for this patient, how it's
                  currently adapted, and what outcome it targets. Each change is labeled
                  as clinician-driven or system-driven for full transparency.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-4">
        {/* ── Live Config State ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3" />
            Current Settings
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-4">
            {/* Difficulty */}
            <div className="rounded-md bg-muted/30 p-2 space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Difficulty</p>
              <p className="text-sm font-semibold">
                {globalDifficulty > 0 ? `+${globalDifficulty}` : globalDifficulty < 0 ? String(globalDifficulty) : "Default"}
              </p>
              {Object.entries(difficultyOverrides).filter(([k]) => k !== "_global").length > 0 && (
                <p className="text-[9px] text-muted-foreground">
                  {Object.entries(difficultyOverrides).filter(([k]) => k !== "_global").length} exercise-specific
                </p>
              )}
            </div>

            {/* Cue Level */}
            <div className="rounded-md bg-muted/30 p-2 space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Cue Level</p>
              <p className="text-sm font-semibold">
                {cueOverride !== null ? `Level ${cueOverride}` : "Auto"}
              </p>
              {cueReviewedAt && (
                <p className="text-[9px] text-muted-foreground">
                  Reviewed {new Date(cueReviewedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              )}
            </div>

            {/* Active Overrides */}
            <div className="rounded-md bg-muted/30 p-2 space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Active Overrides</p>
              <p className="text-sm font-semibold">{activeOverrides.length}</p>
              {activeOverrides.length > 0 && (
                <p className="text-[9px] text-muted-foreground">
                  {activeOverrides.map((o) => overrideTypeLabels[o.overrideType] || o.overrideType).join(", ")}
                </p>
              )}
            </div>

            {/* Practice Assignments */}
            <div className="rounded-md bg-muted/30 p-2 space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Practice Assigned</p>
              <p className="text-sm font-semibold">{activePractice.length}</p>
            </div>
          </div>
        </div>

        {/* ── Active Clinician Overrides ── */}
        {activeOverrides.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Active Clinician Overrides
            </p>
            <div className="space-y-1 pl-4">
              {activeOverrides.map((o) => {
                const changeDesc = o.overrideType === "difficulty"
                  ? `Level ${o.valueBefore?.difficulty_level ?? "?"} → ${o.valueAfter?.difficulty_level ?? "?"} ${o.valueAfter?.target === "_global" ? "(global)" : `(${o.targetSlug?.replace(/-/g, " ") || "specific"})`}`
                  : o.overrideType === "dose_reduction"
                  ? `${o.valueBefore?.target_value ?? "?"}min → ${o.valueAfter?.target_value ?? "?"}min`
                  : o.overrideType === "cue_level"
                  ? `Cue → ${o.valueAfter?.cue_level ?? "reviewed"}`
                  : o.overrideType === "practice_assignment"
                  ? `+1 assignment`
                  : o.reason || JSON.stringify(o.valueAfter);

                return (
                  <div key={o.id} className="flex items-center gap-2 text-xs rounded-md bg-primary/5 px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px] h-5 shrink-0 border-primary/30 text-primary">
                      <User className="w-2.5 h-2.5 mr-0.5" />
                      {overrideTypeLabels[o.overrideType] || o.overrideType}
                    </Badge>
                    <span className="text-foreground font-medium shrink-0">{changeDesc}</span>
                    {o.reason && (
                      <span className="text-muted-foreground truncate flex-1" title={o.reason}>
                        — {o.reason}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    {onReverseOverride && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onReverseOverride(o.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <Undo2 className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            Reverse this override and restore previous state
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Profile → Domain Flow */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Brain className="w-3 h-3" />
            Profile → Exercise Rationale
          </p>

          {(speechImpairments.length > 0 || cognitiveImpairments.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs pl-4">
              <span className="text-muted-foreground">Documented deficits:</span>
              {[...speechImpairments, ...cognitiveImpairments].slice(0, 5).map((imp, i) => (
                <Badge key={i} variant="outline" className="text-[9px] h-5">
                  {typeof imp === "string" ? imp.replace(/_/g, " ") : String(imp)}
                </Badge>
              ))}
              <ArrowRight className="w-3 h-3 text-muted-foreground mx-0.5" />
              <span className="text-muted-foreground">targeting</span>
              {activeCognitiveDomains.slice(0, 4).map((d) => {
                const meta = COGNITIVE_DOMAINS.find((cd) => cd.slug === d);
                return (
                  <Badge key={d} variant="secondary" className="text-[9px] h-5">
                    {meta?.label || d.replace(/_/g, " ")}
                  </Badge>
                );
              })}
            </div>
          )}

          {therapyFocus.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs pl-4">
              <span className="text-muted-foreground">Therapy focus:</span>
              {therapyFocus.map((f, i) => (
                <Badge key={i} className="text-[9px] h-5 bg-primary/10 text-primary border-primary/20">
                  {typeof f === "string" ? f.replace(/_/g, " ") : String(f)}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ── Therapy Focus Map (per-exercise explainability) ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Active Exercises ({activeEntries.length})
          </p>
          <div className="pl-4">
            <TherapyFocusMap
              cardsByDomain={cardsByDomain}
              sessionRationale={sessionRationale}
            />
          </div>
        </div>

        {/* Coverage gaps */}
        {missingDomains.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" />
              Domains Not Covered This Period
            </p>
            <div className="flex flex-wrap gap-1 pl-4">
              {missingDomains.map((d) => {
                const meta = COGNITIVE_DOMAINS.find((cd) => cd.slug === d);
                return (
                  <Badge key={d} variant="outline" className="text-[9px] h-5 border-amber-300 text-amber-600">
                    {meta?.label || d.replace(/_/g, " ")}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Overrides History */}
        {recentOverrides.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" />
              Recent Adjustments
            </p>
            <div className="space-y-1 pl-4">
              {recentOverrides.slice(0, 8).map((o) => {
                const statusColors: Record<string, string> = {
                  suggested: "border-blue-300 text-blue-600 italic",
                  approved: "border-emerald-300 text-emerald-600",
                  active: "border-primary/30 text-primary",
                  reversed: "border-muted text-muted-foreground line-through",
                  superseded: "border-muted text-muted-foreground/70",
                };
                const statusBadgeColors: Record<string, string> = {
                  suggested: "border-blue-300 text-blue-600",
                  approved: "border-emerald-300 text-emerald-600",
                  reversed: "border-amber-300 text-amber-600",
                  superseded: "border-muted text-muted-foreground",
                };
                return (
                  <div key={o.id} className="flex items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-5 shrink-0 ${statusColors[o.status] || "border-primary/30"}`}
                    >
                      <User className="w-2 h-2 mr-0.5" />
                      {overrideTypeLabels[o.overrideType] || o.overrideType}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {o.reason || `${o.overrideType} change`}
                    </span>
                    {o.status !== "active" && (
                      <Badge variant="outline" className={`text-[8px] h-4 ${statusBadgeColors[o.status] || ""}`}>
                        {o.status}
                      </Badge>
                    )}
                    {o.reversedAt && (
                      <span className="text-[9px] text-muted-foreground/50 shrink-0">
                        ↩ {new Date(o.reversedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                      {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI-driven adaptations */}
        {recentAdaptations && recentAdaptations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Bot className="w-3 h-3" />
              System Adaptations
            </p>
            <div className="space-y-1 pl-4">
              {recentAdaptations.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] h-5 shrink-0">
                    <Bot className="w-2 h-2 mr-0.5" />
                    {a.type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-muted-foreground">{a.detail}</span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                    {new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
