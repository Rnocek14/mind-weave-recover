import { useState, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Lightbulb,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { useRecoverySummary, SummaryType } from '@/hooks/useRecoverySummary';
import { formatDistanceToNow } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RecoverySummaryLoadingState } from './RecoverySummaryLoadingState';
import { RecoverySummaryErrorState } from './RecoverySummaryErrorState';

interface RecoverySummaryCardProps {
  userId: string;
  summaryType: SummaryType;
  title: string;
  description: string;
  autoGenerate?: boolean;
}

export const RecoverySummaryCard = memo(function RecoverySummaryCard({ 
  userId, 
  summaryType, 
  title, 
  description,
  autoGenerate = false 
}: RecoverySummaryCardProps) {
  const { 
    getLatestSummary, 
    generating, 
    generateSummary, 
    needsRegeneration,
    loading,
    error 
  } = useRecoverySummary(userId, summaryType);

  const [isExpanded, setIsExpanded] = useState(true);
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);
  const summary = getLatestSummary(summaryType);
  const needsUpdate = needsRegeneration(summary);

  const handleGenerate = async () => {
    setHasAttemptedGeneration(true);
    await generateSummary(summaryType);
  };

  // Auto-generate on mount if needed and enabled
  useState(() => {
    if (autoGenerate && !summary && !loading && !generating) {
      handleGenerate();
    }
  });

  const getTrendIcon = () => {
    if (summaryType !== 'progress' || !summary?.key_insights) return null;
    
    const insightsText = summary.key_insights.join(' ').toLowerCase();
    
    if (insightsText.includes('improv') || insightsText.includes('progress') || insightsText.includes('better')) {
      return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
    } else if (insightsText.includes('declin') || insightsText.includes('difficult') || insightsText.includes('challeng')) {
      return <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Show full enhanced loading state when generating
  if (generating) {
    return (
      <RecoverySummaryLoadingState
        title={title}
        description={description}
        summaryType={summaryType}
      />
    );
  }

  // Show error state if generation failed and user has attempted to generate
  if (error && hasAttemptedGeneration && !summary) {
    return (
      <RecoverySummaryErrorState
        title={title}
        description={description}
        error={error}
        onRetry={handleGenerate}
        isRetrying={generating}
      />
    );
  }

  return (
    <Card className="overflow-hidden" data-recovery-summary>
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{title}</CardTitle>
              {summaryType === 'progress' && getTrendIcon()}
            </div>
            <CardDescription>{description}</CardDescription>
            
            {summary && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  Generated {formatDistanceToNow(new Date(summary.generated_at), { addSuffix: true })}
                </span>
                {needsUpdate && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Update Available
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : summary ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {!summary && !generating && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              No summary generated yet. Click "Generate" to create an AI-powered {summaryType} summary.
            </AlertDescription>
          </Alert>
        )}

        {summary && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="space-y-4">
              {/* Key Insights */}
              {summary.key_insights && summary.key_insights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <span>Key Insights</span>
                  </div>
                  <div className="grid gap-2">
                    {summary.key_insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-primary">{idx + 1}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Summary - Collapsible */}
              <div className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm font-medium">Full Summary</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none pl-4 border-l-2 border-primary/20">
                    {summary.ai_summary.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="text-sm leading-relaxed mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>

              {/* Metadata */}
              {summary.model_used && (
                <div className="flex items-center gap-4 pt-4 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>AI Model: {summary.model_used.split('/')[1]}</span>
                  </div>
                  {summary.generation_duration_ms && (
                    <div>
                      Generated in {(summary.generation_duration_ms / 1000).toFixed(1)}s
                    </div>
                  )}
                  {summary.confidence_score && (
                    <div>
                      Confidence: {(summary.confidence_score * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimer */}
              <Alert variant="default" className="bg-muted/30 border-muted">
                <AlertDescription className="text-xs text-muted-foreground">
                  This is an AI-generated summary based on your clinical data. Always consult your healthcare provider for medical advice and treatment decisions.
                </AlertDescription>
              </Alert>
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
});
