import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Brain, 
  FileText, 
  TrendingUp,
  CheckCircle2,
  Loader2 
} from 'lucide-react';

interface RecoverySummaryLoadingStateProps {
  title: string;
  description: string;
  summaryType: 'progress' | 'education';
}

const generationStages = [
  { id: 1, label: 'Analyzing clinical profile', icon: FileText, duration: 2000 },
  { id: 2, label: 'Processing performance data', icon: Brain, duration: 2500 },
  { id: 3, label: 'Extracting key insights', icon: TrendingUp, duration: 2000 },
  { id: 4, label: 'Generating summary', icon: Sparkles, duration: 3000 },
];

export const RecoverySummaryLoadingState = ({ 
  title, 
  description,
  summaryType 
}: RecoverySummaryLoadingStateProps) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const estimatedTotalTime = 10; // seconds

  useEffect(() => {
    // Progress through stages
    const stageInterval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < generationStages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2500);

    // Smooth progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 95) {
          return prev + 1;
        }
        return prev;
      });
    }, 100);

    // Elapsed time counter
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const CurrentIcon = generationStages[currentStage]?.icon || Loader2;

  return (
    <Card className="overflow-hidden animate-fade-in">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Generating...
            </Badge>
          </div>

          {/* Progress Bar with Time Estimate */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CurrentIcon className="h-4 w-4 animate-pulse text-primary" />
                <span className="font-medium">{generationStages[currentStage]?.label}</span>
              </div>
              <span>
                ~{Math.max(0, estimatedTotalTime - elapsedTime)}s remaining
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Stage Progress Indicators */}
        <div className="flex items-center justify-between gap-2 px-2">
          {generationStages.map((stage, idx) => {
            const isComplete = idx < currentStage;
            const isCurrent = idx === currentStage;
            const StageIcon = stage.icon;

            return (
              <div key={stage.id} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isComplete
                      ? 'bg-primary text-primary-foreground scale-100'
                      : isCurrent
                      ? 'bg-primary/20 text-primary scale-110 animate-pulse'
                      : 'bg-muted text-muted-foreground scale-90'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <StageIcon className={`h-4 w-4 ${isCurrent ? 'animate-pulse' : ''}`} />
                  )}
                </div>
                <span
                  className={`text-[10px] text-center leading-tight transition-colors ${
                    isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {stage.label.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Structured Skeleton matching actual layout */}
        <div className="space-y-4">
          {/* Key Insights Skeleton */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Summary Skeleton */}
          <div className="space-y-3 pt-4 border-t">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <div className="pt-2 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">
            AI is analyzing your {summaryType === 'progress' ? 'recovery data' : 'stroke profile'} to generate personalized insights...
          </p>
        </div>

        {/* Explanation */}
        <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
          <p>
            This takes time because we're processing your complete clinical history, 
            performance data, and generating evidence-based insights using advanced AI.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
