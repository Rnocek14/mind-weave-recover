/**
 * "Why This Plan" — Traceability card showing how the clinical profile
 * drives exercise selection, cue level, difficulty, and recent adjustments.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, ArrowRight, Brain, Target, Volume2, SlidersHorizontal, Zap } from "lucide-react";
import { HelpLabel } from "@/components/HelpTooltip";
import { EXERCISE_DOMAIN_MAP, getExerciseDomain, type ExerciseDomainEntry } from "@/lib/exerciseDomainMap";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";

interface WhyThisPlanProps {
  clinicalProfile: Record<string, any> | null;
  /** Exercise slugs the patient actually used in the current window */
  activeExerciseSlugs: string[];
  /** Recent adaptation events for display */
  recentAdaptations?: Array<{
    type: string;
    detail: string;
    date: string;
  }>;
}

export function WhyThisPlan({ clinicalProfile, activeExerciseSlugs, recentAdaptations }: WhyThisPlanProps) {
  const cp = clinicalProfile;
  const therapyFocus: string[] = cp?.therapy_focus || [];
  const speechImpairments: string[] = cp?.impairments?.speech || [];
  const cognitiveImpairments: string[] = cp?.impairments?.cognitive || [];

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

  // Group exercises by their recovery domain
  const exercisesByDomain = useMemo(() => {
    const map: Record<string, ExerciseDomainEntry[]> = {};
    activeEntries.forEach((e) => {
      if (!map[e.recoveryDomain]) map[e.recoveryDomain] = [];
      map[e.recoveryDomain].push(e);
    });
    return map;
  }, [activeEntries]);

  if (activeExerciseSlugs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <HelpLabel term="Plan Traceability">Why This Plan</HelpLabel>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p>
                  Shows how the clinical profile drives exercise selection. Each exercise
                  targets specific cognitive domains based on documented deficits and therapy
                  focus areas. This transparency ensures every activity in the plan has a
                  clinical rationale.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-4">
        {/* Profile → Domain Flow */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Brain className="w-3 h-3" />
            Profile → Exercise Rationale
          </p>

          {/* Impairments driving the plan */}
          {(speechImpairments.length > 0 || cognitiveImpairments.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs pl-4">
              <span className="text-muted-foreground">Documented deficits:</span>
              {[...speechImpairments, ...cognitiveImpairments].slice(0, 5).map((imp, i) => (
                <Badge key={i} variant="outline" className="text-[9px] h-5">
                  {imp.replace(/_/g, " ")}
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

          {/* Therapy focus areas */}
          {therapyFocus.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs pl-4">
              <span className="text-muted-foreground">Therapy focus:</span>
              {therapyFocus.map((f, i) => (
                <Badge key={i} className="text-[9px] h-5 bg-primary/10 text-primary border-primary/20">
                  {f.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Exercise → Domain mapping */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Active Exercises ({activeEntries.length})
          </p>
          <div className="space-y-1 pl-4">
            {Object.entries(exercisesByDomain).map(([domain, exercises]) => (
              <div key={domain} className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {domain.replace(/_/g, " ")}
                </p>
                {exercises.map((ex) => (
                  <div key={ex.slug} className="flex items-start gap-2 text-xs py-0.5">
                    <span className="font-medium min-w-[120px] shrink-0">
                      {ex.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{ex.clinicalRationale}</span>
                    {ex.hasSpeechOutput && (
                      <Volume2 className="w-3 h-3 text-primary/50 shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            ))}
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

        {/* Recent adjustments */}
        {recentAdaptations && recentAdaptations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" />
              Recent Adjustments
            </p>
            <div className="space-y-1 pl-4">
              {recentAdaptations.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] h-5 shrink-0">
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
