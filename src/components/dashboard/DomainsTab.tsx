import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ArrowRight, Info, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CognitiveStateCard } from "@/components/dashboard/CognitiveStateCard";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { COGNITIVE_DOMAINS, type DomainScore } from "@/lib/cognitiveStateEngine";

/** ICF-aligned groupings */
const ICF_GROUPS = [
  {
    label: "Communication & Language",
    description: "Body functions: speech, language, comprehension",
    icon: MessageSquare,
    slugs: ["lexical_retrieval", "phonology", "syntax", "semantic_depth", "discourse_organization"],
  },
  {
    label: "Cognition",
    description: "Executive control, planning, cognitive flexibility",
    icon: Brain,
    slugs: ["executive_function"],
  },
  {
    label: "Functional Endurance",
    description: "Sustained performance capacity",
    icon: Zap,
    slugs: ["cognitive_endurance"],
  },
];

function DomainDetailRow({ domain }: { domain: DomainScore }) {
  const meta = COGNITIVE_DOMAINS.find((d) => d.slug === domain.domainSlug);
  const hasData = domain.trialCount >= 3;
  const depthCount = (domain.scoreComponents as any)?.depthTrialCount ?? 0;
  const topComponents = useMemo(() => {
    const comps = domain.scoreComponents || {};
    return Object.entries(comps)
      .filter(([k]) => !["depthTrialCount", "depthWeight"].includes(k))
      .filter(([, v]) => typeof v === "number" && v > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3);
  }, [domain.scoreComponents]);

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">
          {meta?.label || domain.domainSlug.replace(/_/g, " ")}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {domain.trialCount} trials
          </Badge>
          {depthCount > 0 && (
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {depthCount} depth
            </Badge>
          )}
          <Badge
            variant={
              domain.confidence === "high"
                ? "default"
                : domain.confidence === "medium"
                ? "secondary"
                : "outline"
            }
            className="text-[10px]"
          >
            {domain.confidence}
          </Badge>
        </div>
      </div>
      {hasData && topComponents.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {topComponents.map(([key, val]) => (
            <span
              key={key}
              className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
            >
              {key.replace(/([A-Z])/g, " $1").trim()}: {((val as number) * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      )}
      {!hasData && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Needs {3 - domain.trialCount} more trial{3 - domain.trialCount !== 1 ? "s" : ""} to score
        </p>
      )}
    </div>
  );
}

export const DomainsTab = memo(function DomainsTab() {
  const { userId } = useDashboardContext();
  const { activeProfile } = useProfile();
  const { snapshot, isLoading } = useCognitiveState({
    userId,
    profileId: activeProfile?.id,
  });

  const domains = snapshot?.domains || [];
  const scoredDomains = domains.filter((d) => d.trialCount >= 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cognitive Recovery Map — visual overview */}
      <CognitiveStateCard domains={domains} isLoading={isLoading} />

      {/* ICF-Aligned Domain Groups */}
      {!isLoading &&
        ICF_GROUPS.map((group) => {
          const groupDomains = domains.filter((d) =>
            group.slugs.includes(d.domainSlug)
          );
          if (groupDomains.length === 0) return null;
          const GroupIcon = group.icon;

          return (
            <Card key={group.label} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <GroupIcon className="w-4 h-4 text-primary" />
                <div>
                  <h4 className="text-sm font-semibold">{group.label}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {group.description}
                  </p>
                </div>
              </div>
              <div>
                {groupDomains.map((d) => (
                  <DomainDetailRow key={d.domainSlug} domain={d} />
                ))}
              </div>
            </Card>
          );
        })}

      {/* Data Sufficiency Summary */}
      {!isLoading && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Data Coverage</p>
              <p className="text-sm text-muted-foreground">
                {scoredDomains.length} of {domains.length} domains have enough
                data to score.
                {scoredDomains.length < domains.length && (
                  <>
                    {" "}
                    Complete more exercises to fill gaps in{" "}
                    {domains
                      .filter((d) => d.trialCount < 3)
                      .map((d) => d.domainSlug.replace(/_/g, " "))
                      .join(", ")}
                    .
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Deep Dive CTA */}
      <Card className="p-4 border-dashed border-2 hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Detailed Analysis</p>
              <p className="text-xs text-muted-foreground">
                Trends, error patterns & what's helping
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/insights">
              View <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
});
