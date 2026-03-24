/**
 * WhatsAffectedCard — Simplified brain map for caregivers.
 * Translates clinical stroke data into plain-language behavior explanations.
 * Maps: brain area → what it does → how stroke affects behavior → what therapy targets.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, MessageSquare, Eye, Zap, Hand } from "lucide-react";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

interface WhatsAffectedCardProps {
  clinicalProfile: ClinicalProfile;
}

interface AffectedArea {
  icon: React.ElementType;
  title: string;
  helps: string;
  effect: string;
  therapy: string;
}

function mapImpairmentsToBehavior(profile: ClinicalProfile): AffectedArea[] {
  const areas: AffectedArea[] = [];
  const impairments = (profile as any)?.speech_characteristics?.impairment_types || [];
  const aphasiaType = (profile as any)?.aphasia_type || "";
  const hemisphere = (profile as any)?.stroke_hemisphere || (profile as any)?.laterality || "";

  // Speech / Word-finding
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
    });
  }

  // Comprehension
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
    });
  }

  // Motor speech / articulation
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
    });
  }

  // Executive function
  if (impairments.includes("executive") || impairments.includes("planning")) {
    areas.push({
      icon: Zap,
      title: "Planning & Thinking",
      helps: "Organizing thoughts and planning steps",
      effect: "They may struggle with multi-step tasks or seem easily overwhelmed",
      therapy: "Games that practice sequencing, categorizing, and problem-solving",
    });
  }

  // Visual / neglect
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
    });
  }

  // Motor
  if (impairments.includes("hemiparesis") || impairments.includes("motor")) {
    areas.push({
      icon: Hand,
      title: "Movement",
      helps: "Moving arms and hands with control",
      effect: "One side may be weaker or harder to coordinate",
      therapy: "Touch and tap exercises that encourage using the affected hand",
    });
  }

  // Fallback: if nothing matched, show a generic speech area
  if (areas.length === 0) {
    areas.push({
      icon: MessageSquare,
      title: "Communication",
      helps: "Finding words and speaking clearly",
      effect: "Speech may be slower or harder than before the stroke",
      therapy: "Exercises that practice word retrieval and speech patterns",
    });
  }

  return areas;
}

export function WhatsAffectedCard({ clinicalProfile }: WhatsAffectedCardProps) {
  const areas = mapImpairmentsToBehavior(clinicalProfile);

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
        {areas.map((area) => {
          const Icon = area.icon;
          return (
            <div key={area.title} className="space-y-1.5 p-3 rounded-lg bg-muted/50">
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
