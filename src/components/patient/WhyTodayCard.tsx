import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { useMemo } from "react";

interface WhyTodayCardProps {
  lesson: DailyLesson;
}

/** Plain-language domain labels for patients */
const DOMAIN_LABELS: Record<string, string> = {
  naming: "word finding",
  comprehension: "understanding words",
  reading: "reading practice",
  sentence_construction: "building sentences",
  conversation: "conversation skills",
  attention: "focus and attention",
  memory: "memory practice",
  problem_solving: "problem solving",
  phonological: "sound practice",
  semantic: "word meaning",
};

/**
 * Compact "Why Today" card — tells the patient what today's session
 * focuses on and why, in ≤1 sentence with no jargon.
 */
export function WhyTodayCard({ lesson }: WhyTodayCardProps) {
  const explanation = useMemo(() => {
    if (!lesson) return null;

    // Try to use the lesson's reasoning array first
    const reasoning = lesson.reasoning;
    if (reasoning?.length) {
      // Filter out technical preset markers
      const humanReadable = reasoning.find(
        (r) => !r.startsWith("Preset:") && !r.startsWith("Domain:") && r.length > 10
      );
      if (humanReadable) {
        // Clean up any clinical language
        return humanReadable
          .replace(/domain/gi, "area")
          .replace(/deficit/gi, "area to work on")
          .replace(/impairment/gi, "challenge");
      }
    }

    // Fall back to target domains
    const domains = lesson.targetDomains || [];
    if (domains.length === 0) return null;

    const labels = domains
      .slice(0, 2)
      .map((d) => DOMAIN_LABELS[d] || d.replace(/_/g, " "))
      .join(" and ");

    return `Today we're working on ${labels} to help build your skills.`;
  }, [lesson]);

  if (!explanation) return null;

  return (
    <Card className="p-4 border bg-accent/30 flex items-start gap-3">
      <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-foreground leading-relaxed">{explanation}</p>
    </Card>
  );
}
