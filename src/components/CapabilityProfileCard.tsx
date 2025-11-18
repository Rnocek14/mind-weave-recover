import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Eye, Hand, Focus, RefreshCw } from "lucide-react";
import { useCapabilityProgression } from "@/hooks/useCapabilityProgression";
import { Skeleton } from "@/components/ui/skeleton";

interface CapabilityProfileCardProps {
  userId: string | undefined;
  currentAssessment?: any;
  onStartAssessment: () => void;
}

export const CapabilityProfileCard = ({ 
  userId, 
  currentAssessment,
  onStartAssessment 
}: CapabilityProfileCardProps) => {
  const { progression, loading, getTrend, hasMultipleAssessments } = useCapabilityProgression(userId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!currentAssessment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capability Assessment</CardTitle>
          <CardDescription>
            Let's discover your current abilities with a quick, guided assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onStartAssessment} className="w-full" size="lg">
            Start Capability Assessment
          </Button>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            This takes 5-7 minutes and requires no speaking or reading
          </p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const visionScore = currentAssessment.vision_score || 0;
  const motorScore = currentAssessment.motor_score || 0;
  const attentionScore = currentAssessment.attention_score || 0;

  const assessmentDate = new Date(currentAssessment.assessed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Capability Profile</CardTitle>
            <CardDescription>
              Last assessed {assessmentDate}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onStartAssessment}
            title="Reassess capabilities"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vision Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <span className="font-medium">Vision</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{visionScore}/10</span>
              {hasMultipleAssessments && TrendIcon(getTrend('vision'))}
            </div>
          </div>
          <Progress value={visionScore * 10} className="h-2" />
        </div>

        {/* Motor Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hand className="h-5 w-5 text-primary" />
              <span className="font-medium">Motor Control</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{motorScore}/10</span>
              {hasMultipleAssessments && TrendIcon(getTrend('motor'))}
            </div>
          </div>
          <Progress value={motorScore * 10} className="h-2" />
        </div>

        {/* Attention Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Focus className="h-5 w-5 text-primary" />
              <span className="font-medium">Attention</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{attentionScore}/10</span>
              {hasMultipleAssessments && TrendIcon(getTrend('attention'))}
            </div>
          </div>
          <Progress value={attentionScore * 10} className="h-2" />
        </div>

        {currentAssessment.confidence_score && (
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Assessment confidence: {Math.round(currentAssessment.confidence_score * 100)}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
