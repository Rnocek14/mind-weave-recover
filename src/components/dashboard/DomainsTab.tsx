import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CognitiveStateCard } from "@/components/dashboard/CognitiveStateCard";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardContext } from "@/hooks/useDashboardContext";

export const DomainsTab = memo(function DomainsTab() {
  const { userId } = useDashboardContext();
  const { activeProfile } = useProfile();
  const { snapshot, isLoading } = useCognitiveState({
    userId,
    profileId: activeProfile?.id,
  });

  const domains = snapshot?.domains || [];
  const scoredDomains = domains.filter(d => d.trialCount >= 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cognitive Recovery Map — expanded, centerpiece */}
      <CognitiveStateCard domains={domains} isLoading={isLoading} />

      {/* Data Sufficiency Summary */}
      {!isLoading && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Data Coverage</p>
              <p className="text-sm text-muted-foreground">
                {scoredDomains.length} of {domains.length} domains have enough data to score.
                {scoredDomains.length < domains.length && (
                  <> Complete more exercises to fill gaps in{" "}
                    {domains
                      .filter(d => d.trialCount < 3)
                      .map(d => d.domainSlug.replace(/_/g, " "))
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
