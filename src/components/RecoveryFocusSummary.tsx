/**
 * RecoveryFocusSummary — The bridge between therapy plan, caregiver view, and recovery metrics.
 * 
 * Answers in one block:
 * - Primary challenge
 * - Current focus (exercises)
 * - Why adapted
 * - Expected gain
 * - Progress signal
 * 
 * Appears in both caregiver and clinician contexts.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { getFieldLabel, type UiRole } from "@/lib/roleVocabulary";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import type { TodayFocus } from "@/lib/adaptiveDecisionEngine";
import { EXERCISE_DOMAIN_MAP } from "@/lib/exerciseDomainMap";

interface RecoveryFocusSummaryProps {
  clinicalProfile: ClinicalProfile | null;
  todayFocus: TodayFocus | null;
  activeExerciseSlugs: string[];
  /** From useCueIndependence */
  cueTrend?: 'improving' | 'stable' | 'declining' | 'insufficient';
  /** From useErrorQualityScore */
  errorTrend?: 'improving' | 'stable' | 'declining' | 'insufficient';
  /** From useLearningRate */
  accuracyTrend?: 'improving' | 'stable' | 'declining' | 'insufficient';
  /** Mastered word count */
  masteredCount?: number;
  /** Whether to show clinician-level detail */
  isClinician?: boolean;
}

interface FocusArea {
  challenge: string;
  exercises: string[];
  adaptationReason: string;
  expectedGain: string;
}

/** Derive primary challenge from clinical profile */
function derivePrimaryChallenge(profile: ClinicalProfile | null): string {
  if (!profile) return 'Communication recovery';
  const impairments = (profile as any)?.speech_characteristics?.impairment_types || [];
  const aphasia = (profile as any)?.aphasia_type || '';

  if (impairments.includes('anomia') || aphasia.includes('anomic'))
    return 'Word finding and naming';
  if (aphasia.includes('broca'))
    return 'Speech production and word retrieval';
  if (aphasia.includes('wernicke') || impairments.includes('comprehension'))
    return 'Understanding and processing language';
  if (aphasia.includes('global'))
    return 'Comprehensive language recovery';
  if (impairments.includes('apraxia'))
    return 'Speech motor planning';
  if (impairments.includes('executive'))
    return 'Planning, organizing, and flexible thinking';
  if (impairments.includes('neglect'))
    return 'Visual attention and awareness';
  return 'Communication and cognitive recovery';
}

/** Map active exercises to readable names */
function getExerciseNames(slugs: string[]): string[] {
  return slugs
    .map(slug => {
      const entry = EXERCISE_DOMAIN_MAP.find(e => e.slug === slug);
      return entry
        ? slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : null;
    })
    .filter(Boolean) as string[];
}

/** Derive why the system adapted from TodayFocus */
function deriveAdaptationReason(focus: TodayFocus | null): string {
  if (!focus) return 'Based on recovery profile';
  const reasons = focus.reasoning || [];
  if (reasons.length > 0) return reasons[0];
  const rules = focus.rulesApplied || [];
  if (rules.length > 0) return rules[0]?.description || 'Adaptive adjustments applied';
  return 'Plan adjusted to current performance level';
}

/** Map challenge to expected gain */
function deriveExpectedGain(profile: ClinicalProfile | null): string {
  if (!profile) return 'Improved communication independence';
  const impairments = (profile as any)?.speech_characteristics?.impairment_types || [];
  const aphasia = (profile as any)?.aphasia_type || '';

  if (impairments.includes('anomia') || aphasia.includes('anomic') || aphasia.includes('broca'))
    return 'More independent word retrieval with less cueing';
  if (aphasia.includes('wernicke') || impairments.includes('comprehension'))
    return 'Better understanding of spoken language';
  if (impairments.includes('apraxia'))
    return 'Clearer, more coordinated speech';
  if (impairments.includes('executive'))
    return 'Stronger planning and problem-solving';
  if (impairments.includes('neglect'))
    return 'Improved awareness across visual field';
  return 'Improved communication independence';
}

function ProgressSignal({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'insufficient' }) {
  const config = {
    improving: { label: 'Improving', icon: TrendingUp, className: 'text-success' },
    stable: { label: 'Stable', icon: Minus, className: 'text-muted-foreground' },
    declining: { label: 'Needs attention', icon: TrendingDown, className: 'text-destructive' },
    insufficient: { label: 'Building data', icon: AlertTriangle, className: 'text-muted-foreground' },
  };
  const c = config[trend];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

/** Compute overall progress signal from individual trends */
function overallSignal(
  accuracy?: string,
  cue?: string,
  error?: string,
): 'improving' | 'stable' | 'declining' | 'insufficient' {
  const trends = [accuracy, cue, error].filter(Boolean);
  if (trends.length === 0) return 'insufficient';
  const improving = trends.filter(t => t === 'improving').length;
  const declining = trends.filter(t => t === 'declining').length;
  if (improving >= 2) return 'improving';
  if (declining >= 2) return 'declining';
  if (improving >= 1) return 'improving';
  return 'stable';
}

export function RecoveryFocusSummary({
  clinicalProfile,
  todayFocus,
  activeExerciseSlugs,
  cueTrend,
  errorTrend,
  accuracyTrend,
  masteredCount,
  isClinician = false,
}: RecoveryFocusSummaryProps) {
  const role: UiRole = isClinician ? "clinician" : "patient";
  const challenge = useMemo(() => derivePrimaryChallenge(clinicalProfile), [clinicalProfile]);
  const exerciseNames = useMemo(() => getExerciseNames(activeExerciseSlugs).slice(0, 4), [activeExerciseSlugs]);
  const adaptationReason = useMemo(() => deriveAdaptationReason(todayFocus), [todayFocus]);
  const expectedGain = useMemo(() => deriveExpectedGain(clinicalProfile), [clinicalProfile]);
  const signal = useMemo(() => overallSignal(accuracyTrend, cueTrend, errorTrend), [accuracyTrend, cueTrend, errorTrend]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" />
          {getFieldLabel("card_title", role)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Row 1: Primary challenge */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-24 shrink-0 pt-0.5">
            {getFieldLabel("primary_challenge", role)}
          </span>
          <span className="text-sm font-medium text-foreground">{challenge}</span>
        </div>

        {/* Row 2: Current focus exercises */}
        {exerciseNames.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24 shrink-0 pt-0.5">
              {getFieldLabel("current_focus", role)}
            </span>
            <div className="flex flex-wrap gap-1">
              {exerciseNames.map(name => (
                <Badge key={name} variant="secondary" className="text-[11px] py-0">
                  {name}
                </Badge>
              ))}
              {activeExerciseSlugs.length > 4 && (
                <Badge variant="outline" className="text-[11px] py-0">
                  +{activeExerciseSlugs.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Why adapted */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-24 shrink-0 pt-0.5">
            {isClinician ? 'Why adapted' : 'Adjusted for'}
          </span>
          <span className="text-sm text-muted-foreground">{adaptationReason}</span>
        </div>

        {/* Row 4: Expected gain */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground w-24 shrink-0 pt-0.5">
            {isClinician ? 'Expected gain' : 'Goal'}
          </span>
          <span className="text-sm text-muted-foreground">{expectedGain}</span>
        </div>

        {/* Row 5: Progress signal */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Progress</span>
            <ProgressSignal trend={signal} />
          </div>
          {masteredCount !== undefined && masteredCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {masteredCount} word{masteredCount !== 1 ? 's' : ''} mastered
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
