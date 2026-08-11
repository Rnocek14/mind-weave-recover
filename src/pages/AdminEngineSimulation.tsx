/**
 * Engine Simulation QA Panel — Admin-only
 * 
 * Runs the lesson engine against 4 test clinical profiles and displays:
 * - Detected aphasia type & domain priorities
 * - Full scored candidate list
 * - Selected exercises with reasoning
 * - Excluded candidates with reasons
 * - Focus areas covered vs uncovered
 * - Intended outcome metrics
 */

import { useState, useMemo } from "react";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import type { PerformanceSignals, DomainPriority, LearningRateData } from "@/lib/dailyLessonEngine";
import {
  generateDailyLesson,
  calculateDomainPriorities,
  detectAphasiaType,
  scoreExercise,
} from "@/lib/dailyLessonEngine";
import { getAccessibleExercises } from "@/lib/exerciseGating";
import { CANONICAL_EXERCISES } from "@/data/canonicalExerciseRegistry";

// ─── Test Profiles ───

const TEST_PROFILES: Record<string, { label: string; description: string; profile: ClinicalProfile }> = {
  anomic: {
    label: "Anomic Aphasia",
    description: "Primary naming deficit, relatively preserved comprehension",
    profile: {
      affected_side: "right",
      stroke_location: "left temporal-parietal",
      impairments: {
        speech: ["Anomic Aphasia", "Word-finding difficulties"],
        motor: [],
        visual: [],
        cognitive: [],
      },
      severity: { speech: "moderate" },
      therapy_focus: ["naming", "word retrieval"],
      notes: "47 days post-stroke",
      last_updated: new Date().toISOString(),
      profile_source: "manual",
      extraction_metadata: {},
    },
  },
  broca: {
    label: "Broca's Aphasia",
    description: "Non-fluent, effortful speech, relatively preserved comprehension",
    profile: {
      affected_side: "right",
      stroke_location: "left frontal (Broca's area)",
      impairments: {
        speech: ["Broca's Aphasia", "Non-fluent speech", "Agrammatism"],
        motor: ["Right hemiparesis"],
        visual: [],
        cognitive: [],
      },
      severity: { speech: "moderate-severe", motor: "mild" },
      therapy_focus: ["expressive language", "sentence formation", "motor speech"],
      notes: "30 days post-stroke",
      last_updated: new Date().toISOString(),
      profile_source: "manual",
      extraction_metadata: {},
    },
  },
  wernicke: {
    label: "Wernicke's Aphasia",
    description: "Fluent but impaired comprehension, semantic errors",
    profile: {
      affected_side: "right",
      stroke_location: "left posterior temporal (Wernicke's area)",
      impairments: {
        speech: ["Wernicke's Aphasia", "Receptive language deficit", "Semantic paraphasias"],
        motor: [],
        visual: [],
        cognitive: ["Attention deficit"],
      },
      severity: { speech: "moderate-severe" },
      therapy_focus: ["comprehension", "semantic processing"],
      notes: "21 days post-stroke",
      last_updated: new Date().toISOString(),
      profile_source: "manual",
      extraction_metadata: {},
    },
  },
  neglect: {
    label: "Left Neglect + Motor",
    description: "Visuospatial neglect with motor impairment, mild speech",
    profile: {
      affected_side: "left",
      stroke_location: "right parietal",
      impairments: {
        speech: [],
        motor: ["Left hemiparesis", "Upper limb weakness"],
        visual: ["Left-sided neglect", "Visual inattention"],
        cognitive: ["Attention deficit", "Executive dysfunction"],
      },
      severity: { motor: "moderate", visual: "moderate" },
      therapy_focus: ["visual scanning", "attention", "motor recovery"],
      notes: "14 days post-stroke",
      last_updated: new Date().toISOString(),
      profile_source: "manual",
      extraction_metadata: {},
    },
  },
};

const DEFAULT_PERF: PerformanceSignals = {
  avgReactionTime: 3000,
  avgAccuracy: 0.5,
  timeoutRate: 0.1,
  errorTypes: { semantic: 0, phonological: 0, omissions: 0, perseverations: 0 },
  frustrationLevel: "low",
  fatigueLevel: "low",
  engagementScore: 5,
};

const DEFAULT_CAPABILITY = { vision: 8, motor: 8, attention: 7, confidence: 0.8 };

interface SimulationResult {
  aphasiaType: string | null;
  priorities: DomainPriority;
  allScored: Array<{ slug: string; score: number; domains: string[]; focusAreas: string[]; outcomeMetrics: string[] }>;
  selectedSlugs: string[];
  lesson: ReturnType<typeof generateDailyLesson>;
  coveredFocusAreas: string[];
  uncoveredFocusAreas: string[];
  coveredOutcomes: string[];
}

function runSimulation(profileKey: string): SimulationResult {
  const { profile } = TEST_PROFILES[profileKey];
  const aphasiaType = detectAphasiaType(profile);
  const priorities = calculateDomainPriorities(profile);
  const accessibleSlugs = getAccessibleExercises(DEFAULT_CAPABILITY);

  // Score all exercises
  const allScored = accessibleSlugs
    .map((slug) => {
      const canonical = CANONICAL_EXERCISES.find((e) => e.slug === slug);
      if (!canonical) return null;
      const score = scoreExercise(slug, canonical.engineDomains, priorities, [], DEFAULT_PERF.errorTypes);
      return {
        slug,
        score,
        domains: canonical.engineDomains,
        focusAreas: canonical.focusAreas,
        outcomeMetrics: canonical.outcomeMetrics,
      };
    })
    .filter(Boolean) as SimulationResult["allScored"];

  allScored.sort((a, b) => b.score - a.score);

  // Generate lesson
  const lesson = generateDailyLesson(
    DEFAULT_CAPABILITY,
    profile,
    accessibleSlugs,
    DEFAULT_PERF,
    [] as LearningRateData[],
    null,
    null,
    null,
    null,
    null,
    null,
    null
  );

  const selectedSlugs = lesson.blocks.map((b) => b.exerciseId);

  // Focus area analysis
  const allProfileFocusAreas = new Set<string>();
  profile.therapy_focus?.forEach((f) => allProfileFocusAreas.add(f));
  // Also include deficit-implied focus areas
  const deficitToFocus: Record<string, string[]> = {
    anomic: ["naming", "word_retrieval", "semantic_access"],
    broca: ["sentence_formation", "phonological_production", "motor_speech"],
    wernicke: ["comprehension", "semantic_processing", "auditory_processing"],
  };
  if (aphasiaType && deficitToFocus[aphasiaType]) {
    deficitToFocus[aphasiaType].forEach((f) => allProfileFocusAreas.add(f));
  }

  const coveredFocusAreas = new Set<string>();
  const coveredOutcomes = new Set<string>();
  selectedSlugs.forEach((slug) => {
    const canonical = CANONICAL_EXERCISES.find((e) => e.slug === slug);
    if (canonical) {
      canonical.focusAreas.forEach((fa) => coveredFocusAreas.add(fa));
      canonical.outcomeMetrics.forEach((om) => coveredOutcomes.add(om));
    }
  });

  const uncoveredFocusAreas = [...allProfileFocusAreas].filter((fa) => !coveredFocusAreas.has(fa));

  return {
    aphasiaType,
    priorities,
    allScored,
    selectedSlugs,
    lesson,
    coveredFocusAreas: [...coveredFocusAreas],
    uncoveredFocusAreas,
    coveredOutcomes: [...coveredOutcomes],
  };
}

function PriorityBadge({ level }: { level: string }) {
  const variant = level === "high" ? "default" : level === "medium" ? "secondary" : "outline";
  return <Badge variant={variant} className="text-xs">{level}</Badge>;
}

function SimulationPanel({ profileKey }: { profileKey: string }) {
  const { label, description } = TEST_PROFILES[profileKey];
  const result = useMemo(() => runSimulation(profileKey), [profileKey]);
  const [showAll, setShowAll] = useState(false);

  const selected = new Set(result.selectedSlugs);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Aphasia Detection */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Detected:</span>
            <Badge variant="default">{result.aphasiaType || "none"}</Badge>
          </div>

          {/* Domain Priorities */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Domain Priorities</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.priorities).map(([domain, level]) => (
                <div key={domain} className="flex items-center gap-1">
                  <span className="text-xs font-mono">{domain}</span>
                  <PriorityBadge level={level} />
                </div>
              ))}
            </div>
          </div>

          {/* Generated Lesson */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Generated Lesson ({result.lesson.totalDuration}min, {result.lesson.blocks.length} blocks)
            </h4>
            <div className="space-y-1">
              {result.lesson.blocks.map((block, i) => {
                const canonical = CANONICAL_EXERCISES.find((e) => e.slug === block.exerciseId);
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <Badge variant={block.priority === "primary" ? "default" : "secondary"} className="text-xs w-24 justify-center">
                      {block.priority}
                    </Badge>
                    <span className="font-mono text-sm flex-1">{block.exerciseId}</span>
                    <span className="text-xs text-muted-foreground">{block.duration}min</span>
                    <span className="text-xs text-muted-foreground truncate max-w-48">{block.reasoning}</span>
                  </div>
                );
              })}
            </div>
            {result.lesson.reasoning.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                {result.lesson.reasoning.map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
              </div>
            )}
          </div>

          {/* Coverage Analysis */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Covered Outcomes
              </h4>
              <div className="flex flex-wrap gap-1">
                {result.coveredOutcomes.map((o) => (
                  <Badge key={o} variant="outline" className="text-xs">{o}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Covered Focus Areas
              </h4>
              <div className="flex flex-wrap gap-1">
                {result.coveredFocusAreas.slice(0, 8).map((fa) => (
                  <Badge key={fa} variant="outline" className="text-xs">{fa}</Badge>
                ))}
                {result.coveredFocusAreas.length > 8 && (
                  <Badge variant="outline" className="text-xs">+{result.coveredFocusAreas.length - 8}</Badge>
                )}
              </div>
            </div>
          </div>
          {result.uncoveredFocusAreas.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Uncovered Focus Areas
              </h4>
              <div className="flex flex-wrap gap-1">
                {result.uncoveredFocusAreas.map((fa) => (
                  <Badge key={fa} variant="destructive" className="text-xs">{fa}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Scoring Table */}
      <Collapsible open={showAll} onOpenChange={setShowAll}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Full Candidate Scoring ({result.allScored.length} exercises)</CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-1.5 font-medium">Exercise</th>
                      <th className="text-left p-1.5 font-medium">Score</th>
                      <th className="text-left p-1.5 font-medium">Status</th>
                      <th className="text-left p-1.5 font-medium">Domains</th>
                      <th className="text-left p-1.5 font-medium">Focus Areas</th>
                      <th className="text-left p-1.5 font-medium">Outcomes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.allScored.map((ex) => (
                      <tr key={ex.slug} className={`border-t border-border/50 ${selected.has(ex.slug) ? "bg-primary/5" : ""}`}>
                        <td className="p-1.5 font-mono">{ex.slug}</td>
                        <td className="p-1.5 font-mono font-bold">{ex.score}</td>
                        <td className="p-1.5">
                          {selected.has(ex.slug) ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </td>
                        <td className="p-1.5">
                          <div className="flex flex-wrap gap-0.5">
                            {ex.domains.map((d) => (
                              <Badge key={d} variant="outline" className="text-[10px] px-1 py-0">{d}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-1.5">
                          <div className="flex flex-wrap gap-0.5">
                            {ex.focusAreas.slice(0, 3).map((fa) => (
                              <Badge key={fa} variant="secondary" className="text-[10px] px-1 py-0">{fa}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-1.5">
                          <div className="flex flex-wrap gap-0.5">
                            {ex.outcomeMetrics.map((om) => (
                              <Badge key={om} variant="outline" className="text-[10px] px-1 py-0">{om}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function AdminEngineSimulation() {
  return (
    <AdminProtectedRoute>
      <div className="min-h-dvh bg-background">
        <div className="container max-w-6xl py-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Engine Simulation QA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Runs the lesson engine against 4 clinical profiles to validate exercise selection, scoring, and coverage.
            </p>
          </div>

          <Tabs defaultValue="anomic">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="anomic">Anomic</TabsTrigger>
              <TabsTrigger value="broca">Broca's</TabsTrigger>
              <TabsTrigger value="wernicke">Wernicke's</TabsTrigger>
              <TabsTrigger value="neglect">Neglect</TabsTrigger>
            </TabsList>
            {Object.keys(TEST_PROFILES).map((key) => (
              <TabsContent key={key} value={key}>
                <SimulationPanel profileKey={key} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
