import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useWordMastery } from "@/hooks/useWordMastery";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import { useMemo } from "react";

interface PatientProgressCardProps {
  userId: string;
  profileId: string;
}

function getTrend(score: number): { label: string; icon: typeof TrendingUp; color: string } {
  if (score >= 0.7) return { label: "Improving", icon: TrendingUp, color: "text-emerald-600" };
  if (score >= 0.4) return { label: "Stable", icon: Minus, color: "text-primary" };
  return { label: "Needs Practice", icon: TrendingDown, color: "text-amber-500" };
}

/**
 * Compact progress card for the Patient Home tab.
 * Shows top domains with trend arrows and a words-mastered count.
 * No clinical language. No percentages above the fold.
 */
export function PatientProgressCard({ userId, profileId }: PatientProgressCardProps) {
  const { snapshot } = useCognitiveState({ userId, profileId });
  const { mastered, emerging } = useWordMastery(userId);

  const topDomains = useMemo(() => {
    if (!snapshot?.domains?.length) return [];
    return snapshot.domains
      .filter((d) => d.trialCount >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => {
        const meta = COGNITIVE_DOMAINS.find((cd) => cd.slug === d.domainSlug);
        const trend = getTrend(d.score);
        return {
          slug: d.domainSlug,
          label: meta?.patientLabel || meta?.label || d.domainSlug,
          score: d.score,
          ...trend,
        };
      });
  }, [snapshot]);

  // Generate the main headline
  const headline = useMemo(() => {
    const improving = topDomains.filter((d) => d.score >= 0.7);
    if (improving.length > 0) {
      return `You're improving at ${improving[0].label.toLowerCase()}`;
    }
    if (topDomains.length > 0) {
      return `Keep practicing ${topDomains[0].label.toLowerCase()}`;
    }
    return "Your progress will show up here";
  }, [topDomains]);

  if (topDomains.length === 0 && mastered === 0) return null;

  return (
    <Card className="p-5 border-2 border-primary/10 bg-gradient-to-br from-card to-primary/5 space-y-4">
      {/* Headline */}
      <p className="text-lg font-semibold text-foreground">{headline}</p>

      {/* Domain trends */}
      {topDomains.length > 0 && (
        <div className="space-y-2.5">
          {topDomains.map((d) => {
            const Icon = d.icon;
            const pct = Math.round(d.score * 100);
            return (
              <div key={d.slug} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{d.label}</span>
                  <span className={`flex items-center gap-1 text-sm font-semibold ${d.color}`}>
                    <Icon className="w-4 h-4" />
                    {d.label === "Improving" ? d.label : d.label}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Words mastered */}
      {mastered > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{mastered}</strong> word{mastered !== 1 ? "s" : ""} mastered
            {emerging > 0 && ` · ${emerging} getting stronger`}
          </span>
        </div>
      )}

      <Button variant="ghost" size="sm" asChild className="w-full text-primary hover:text-primary">
        <Link to="/recovery-progress">
          See full progress <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </Button>
    </Card>
  );
}
