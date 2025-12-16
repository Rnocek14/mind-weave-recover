import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, XCircle, Activity, Mic, Brain, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PipelineMetrics {
  total: number;
  hasSemanticSimilarity: number;
  hasCueTracking: number;
  hasFluencyMetrics: number;
  hasPhonologicalSimilarity: number;
  lastUpdated: string;
}

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  current: number;
  total: number;
  threshold: number;
  description: string;
}

const MetricCard = ({ title, icon, current, total, threshold, description }: MetricCardProps) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isHealthy = percentage >= threshold;
  const isCritical = percentage < threshold - 20;
  
  return (
    <Card className={isCritical ? 'border-destructive' : isHealthy ? 'border-green-500/30' : 'border-yellow-500/30'}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {isHealthy ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : isCritical ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-2xl font-bold">
            <span className={isCritical ? 'text-destructive' : isHealthy ? 'text-green-500' : 'text-yellow-500'}>
              {percentage}%
            </span>
            <Badge variant={isHealthy ? 'default' : isCritical ? 'destructive' : 'secondary'}>
              {current}/{total}
            </Badge>
          </div>
          <Progress 
            value={percentage} 
            className={isCritical ? '[&>div]:bg-destructive' : isHealthy ? '[&>div]:bg-green-500' : '[&>div]:bg-yellow-500'}
          />
          <p className="text-xs text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">Target: ≥{threshold}%</p>
        </div>
      </CardContent>
    </Card>
  );
};

export const PipelineHealthDashboard = () => {
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Query last 24 hours of utterance analyses
        const { data, error: queryError } = await supabase
          .from('utterance_analyses')
          .select('semantic_similarity, cue_type_given, speech_rate_wpm, phonological_similarity, created_at')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;

        const total = data?.length || 0;
        const hasSemanticSimilarity = data?.filter(r => r.semantic_similarity !== null).length || 0;
        const hasCueTracking = data?.filter(r => r.cue_type_given !== null).length || 0;
        const hasFluencyMetrics = data?.filter(r => r.speech_rate_wpm !== null).length || 0;
        const hasPhonologicalSimilarity = data?.filter(r => r.phonological_similarity !== null).length || 0;

        setMetrics({
          total,
          hasSemanticSimilarity,
          hasCueTracking,
          hasFluencyMetrics,
          hasPhonologicalSimilarity,
          lastUpdated: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to fetch pipeline metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Activity className="h-6 w-6 animate-pulse text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading pipeline health...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span>Error loading pipeline metrics: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.total === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-5 w-5" />
            <span>No utterance data in last 24 hours. Complete some speech exercises to see pipeline health.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallHealth = Math.round(
    ((metrics.hasSemanticSimilarity / metrics.total) * 0.3 +
     (metrics.hasCueTracking / metrics.total) * 0.3 +
     (metrics.hasPhonologicalSimilarity / metrics.total) * 0.25 +
     (metrics.hasFluencyMetrics / metrics.total) * 0.15) * 100
  );

  return (
    <div className="space-y-6">
      {/* Overall Health Banner */}
      <Card className={overallHealth >= 80 ? 'border-green-500/30 bg-green-500/5' : overallHealth >= 50 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-destructive bg-destructive/5'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className={`h-6 w-6 ${overallHealth >= 80 ? 'text-green-500' : overallHealth >= 50 ? 'text-yellow-500' : 'text-destructive'}`} />
              <div>
                <p className="font-semibold">Pipeline Health Score: {overallHealth}%</p>
                <p className="text-sm text-muted-foreground">
                  {metrics.total} utterances analyzed in last 24h
                </p>
              </div>
            </div>
            <Badge variant={overallHealth >= 80 ? 'default' : overallHealth >= 50 ? 'secondary' : 'destructive'}>
              {overallHealth >= 80 ? 'Healthy' : overallHealth >= 50 ? 'Degraded' : 'Critical'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Individual Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Semantic Similarity"
          icon={<Brain className="h-4 w-4" />}
          current={metrics.hasSemanticSimilarity}
          total={metrics.total}
          threshold={95}
          description="Meaning-based error classification"
        />
        <MetricCard
          title="Cue Tracking"
          icon={<MessageCircle className="h-4 w-4" />}
          current={metrics.hasCueTracking}
          total={metrics.total}
          threshold={100}
          description="Cue efficacy measurement"
        />
        <MetricCard
          title="Phonological"
          icon={<Activity className="h-4 w-4" />}
          current={metrics.hasPhonologicalSimilarity}
          total={metrics.total}
          threshold={95}
          description="Sound-based similarity scores"
        />
        <MetricCard
          title="Fluency Metrics"
          icon={<Mic className="h-4 w-4" />}
          current={metrics.hasFluencyMetrics}
          total={metrics.total}
          threshold={80}
          description="WPM, pauses (requires recording)"
        />
      </div>

      {/* Diagnostic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Diagnostic Info</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}</p>
          <p>Time window: Last 24 hours</p>
          <p>• Semantic similarity: computed via OpenAI embeddings</p>
          <p>• Cue tracking: 'none' means no cue given, null means logging broken</p>
          <p>• Fluency: requires active audio recording during exercises</p>
        </CardContent>
      </Card>
    </div>
  );
};
