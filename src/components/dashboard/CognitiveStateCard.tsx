import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, MessageSquare, Volume2, AlignLeft, Layers, 
  MessageCircle, Battery, TrendingUp, TrendingDown, Minus, 
  HelpCircle 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { HelpLabel } from "@/components/HelpTooltip";
import type { DomainScore } from "@/lib/cognitiveStateEngine";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";

interface CognitiveStateCardProps {
  domains: DomainScore[];
  isLoading?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare,
  Volume2,
  AlignLeft,
  Layers,
  Brain,
  MessageCircle,
  Battery,
};

function getTrendIcon(trend: DomainScore['trend']) {
  switch (trend) {
    case 'improving': return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
    case 'declining': return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    case 'stable': return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    default: return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50" />;
  }
}

function getConfidenceBadge(confidence: DomainScore['confidence']) {
  switch (confidence) {
    case 'high': return <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">High</Badge>;
    case 'medium': return <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Med</Badge>;
    case 'low': return <Badge variant="outline" className="text-[10px] px-1 py-0 bg-muted text-muted-foreground">Low</Badge>;
  }
}

function getScoreColor(score: number): string {
  if (score >= 0.7) return 'bg-green-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-400';
}

const DomainRow = memo(function DomainRow({ domain }: { domain: DomainScore }) {
  const meta = COGNITIVE_DOMAINS.find(d => d.slug === domain.domainSlug);
  const Icon = ICON_MAP[meta?.icon || 'Brain'] || Brain;
  const pct = Math.round(domain.score * 100);
  const hasData = domain.trialCount >= 3;

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{meta?.patientLabel || meta?.label || domain.domainSlug}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {getTrendIcon(domain.trend)}
            {getConfidenceBadge(domain.confidence)}
            <span className={`text-sm font-semibold tabular-nums ${hasData ? '' : 'text-muted-foreground'}`}>
              {hasData ? `${pct}%` : '—'}
            </span>
          </div>
        </div>
        
        {hasData ? (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(domain.score)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 rounded-full bg-muted" />
        )}
      </div>
    </div>
  );
});

export const CognitiveStateCard = memo(function CognitiveStateCard({ 
  domains, 
  isLoading 
}: CognitiveStateCardProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-48" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-4 h-4 bg-muted rounded" />
              <div className="flex-1 h-3 bg-muted rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const scoredDomains = domains.filter(d => d.trialCount >= 3);
  const avgScore = scoredDomains.length > 0
    ? scoredDomains.reduce((sum, d) => sum + d.score, 0) / scoredDomains.length
    : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">Cognitive Recovery Map</h3>
        </div>
        {scoredDomains.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="text-xs">
                  Avg {Math.round(avgScore * 100)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Average across {scoredDomains.length} scored domains</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="divide-y divide-border">
        {domains.map(domain => (
          <DomainRow key={domain.domainSlug} domain={domain} />
        ))}
      </div>

      {scoredDomains.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2 mt-2">
          Complete more exercises to see your cognitive recovery map
        </p>
      )}

      {/* Fatigue sensitivity callout */}
      {domains.find(d => d.domainSlug === 'cognitive_endurance' && d.fatigueSensitivity !== null && d.fatigueSensitivity > 0.2) && (
        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <Battery className="w-3.5 h-3.5 inline mr-1" />
            Performance drops {Math.round((domains.find(d => d.domainSlug === 'cognitive_endurance')?.fatigueSensitivity || 0) * 100)}% 
            toward end of sessions — shorter sessions may help.
          </p>
        </div>
      )}
    </Card>
  );
});
