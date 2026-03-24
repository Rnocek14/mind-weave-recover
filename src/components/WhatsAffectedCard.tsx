/**
 * WhatsAffectedCard — Simplified brain map for caregivers.
 * Translates clinical stroke data into plain-language behavior explanations.
 * Maps: brain area → what it does → how stroke affects behavior → active exercises helping.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, Eye, Zap, Hand, Gamepad2 } from "lucide-react";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { EXERCISE_DOMAIN_MAP } from "@/lib/exerciseDomainMap";

interface WhatsAffectedCardProps {
  clinicalProfile: ClinicalProfile;
  /** Active exercise slugs from the current lesson/plan */
  activeExerciseSlugs?: string[];
}

interface AffectedArea {
  icon: React.ElementType;
  title: string;
  helps: string;
  effect: string;
  therapy: string;
  /** Cognitive domain slugs this area maps to */
  domainSlugs: string[];
}

/** Map impairments → behavior-level explanations */
function mapImpairmentsToBehavior(profile: ClinicalProfile): AffectedArea[] {
  const areas: AffectedArea[] = [];
  const impairments = (profile as any)?.speech_characteristics?.impairment_types || [];
  const aphasiaType = (profile as any)?.aphasia_type || "";
  const hemisphere = (profile as any)?.stroke_hemisphere || (profile as any)?.laterality || "";

  if (
    impairments.includes("anomia") ||
    impairments.includes("word_finding") ||
    aphasiaType.includes("anomic") ||
    aphasiaType.includes("broca")
  ) {
    areas.push({
      icon: MessageSquare,
      title: "Word Finding",
      helps: "Finding and saying the right words",
      effect: "They may pause, use the wrong word, or describe something instead of naming it",
      therapy: "Practicing naming objects and matching words to meanings",
      domainSlugs: ["lexical_retrieval", "semantic_depth"],
    });
  }

  if (
    impairments.includes("comprehension") ||
    aphasiaType.includes("wernicke") ||
    aphasiaType.includes("global")
  ) {
    areas.push({
      icon: Brain,
      title: "Understanding Speech",
      helps: "Making sense of what people say",
      effect: "They may misunderstand instructions or seem confused by conversation",
      therapy: "Exercises that practice following directions and matching meanings",
      domainSlugs: ["semantic_depth"],
    });
  }

  if (
    impairments.includes("apraxia") ||
    impairments.includes("dysarthria") ||
    impairments.includes("motor_speech")
  ) {
    areas.push({
      icon: MessageSquare,
      title: "Speaking Clearly",
      helps: "Coordinating mouth movements for clear speech",
      effect: "Words may sound slurred, choppy, or hard to understand",
      therapy: "Repeating sounds and words to strengthen speech coordination",
      domainSlugs: ["phonology"],
    });
  }

  if (impairments.includes("executive") || impairments.includes("planning")) {
    areas.push({
      icon: Zap,
      title: "Planning & Thinking",
      helps: "Organizing thoughts and planning steps",
      effect: "They may struggle with multi-step tasks or seem easily overwhelmed",
      therapy: "Games that practice sequencing, categorizing, and problem-solving",
      domainSlugs: ["executive_function"],
    });
  }

  if (
    impairments.includes("neglect") ||
    impairments.includes("visual") ||
    hemisphere.includes("right")
  ) {
    areas.push({
      icon: Eye,
      title: "Visual Attention",
      helps: "Noticing things on both sides of their view",
      effect: "They may miss items on one side or bump into things",
      therapy: "Scanning exercises that encourage looking in all directions",
      domainSlugs: ["executive_function"],
    });
  }

  if (impairments.includes("hemiparesis") || impairments.includes("motor")) {
    areas.push({
      icon: Hand,
      title: "Movement",
      helps: "Moving arms and hands with control",
      effect: "One side may be weaker or harder to coordinate",
      therapy: "Touch and tap exercises that encourage using the affected hand",
      domainSlugs: [],
    });
  }

  if (areas.length === 0) {
    areas.push({
      icon: MessageSquare,
      title: "Communication",
      helps: "Finding words and speaking clearly",
      effect: "Speech may be slower or harder than before the stroke",
      therapy: "Exercises that practice word retrieval and speech patterns",
      domainSlugs: ["lexical_retrieval", "phonology"],
    });
  }

  return areas;
}

/** Find exercises that help a specific affected area */
function getExercisesForArea(
  area: AffectedArea,
  activeExerciseSlugs: string[]
): { slug: string; title: string }[] {
  if (activeExerciseSlugs.length === 0) return [];

  const matching = EXERCISE_DOMAIN_MAP.filter(ex => {
    if (!activeExerciseSlugs.includes(ex.slug)) return false;
    // Match if exercise targets any of this area's domains
    return area.domainSlugs.some(d => ex.cognitiveDomains.includes(d));
  });

  return matching.map(ex => ({
    slug: ex.slug,
    title: ex.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  }));
}

export function WhatsAffectedCard({ clinicalProfile, activeExerciseSlugs = [] }: WhatsAffectedCardProps) {
  const areas = useMemo(() => mapImpairmentsToBehavior(clinicalProfile), [clinicalProfile]);

  const areasWithExercises = useMemo(() => {
    return areas.map(area => ({
      ...area,
      exercises: getExercisesForArea(area, activeExerciseSlugs),
    }));
  }, [areas, activeExerciseSlugs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          What's Affected
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          How the stroke affects daily life and what therapy is working on
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {areasWithExercises.map((area) => {
          const Icon = area.icon;
          return (
            <div key={area.title} className="space-y-2 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground">{area.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">This area helps with:</span>{" "}
                {area.helps}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-warning">Because of the stroke:</span>{" "}
                {area.effect}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-primary">Therapy is focusing on:</span>{" "}
                {area.therapy}
              </p>
              {area.exercises.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <Gamepad2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-medium">Active exercises:</span>
                  {area.exercises.map(ex => (
                    <Badge key={ex.slug} variant="secondary" className="text-[10px] py-0">
                      {ex.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
