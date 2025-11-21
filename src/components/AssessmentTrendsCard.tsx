import { memo, useMemo, lazy, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStandardizedAssessments, AssessmentType } from '@/hooks/useStandardizedAssessments';
import { AddAssessmentDialog } from './AddAssessmentDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

const LineChart = lazy(() => import('recharts').then(mod => ({ default: mod.LineChart })));
const Line = lazy(() => import('recharts').then(mod => ({ default: mod.Line })));
const XAxis = lazy(() => import('recharts').then(mod => ({ default: mod.XAxis })));
const YAxis = lazy(() => import('recharts').then(mod => ({ default: mod.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(mod => ({ default: mod.Tooltip })));
const ResponsiveContainer = lazy(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })));

interface AssessmentTrendsCardProps {
  userId: string;
}

export const AssessmentTrendsCard = memo(({ userId }: AssessmentTrendsCardProps) => {
  const { assessments, loading, addAssessment } = useStandardizedAssessments(userId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent role="status" aria-live="polite">
          <span className="sr-only">Loading assessment data...</span>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const assessmentTypes: AssessmentType[] = ['WAB-R', 'BNT', 'NIHSS', 'ASHA-NOMS'];

  // Get primary score key for each assessment type
  const getPrimaryScoreKey = useMemo(() => (type: AssessmentType): string => {
    switch (type) {
      case 'WAB-R':
        return 'aphasia_quotient';
      case 'BNT':
        return 'total_correct';
      case 'NIHSS':
        return 'total_score';
      case 'ASHA-NOMS':
        return 'spoken_expression';
      default:
        return 'total_score';
    }
  }, []);

  // Group assessments by type
  const groupedAssessments = useMemo(() => 
    assessmentTypes.map((type) => {
      const typeAssessments = assessments.filter((a) => a.assessmentType === type);
      return { type, assessments: typeAssessments };
    }),
    [assessments]
  );

  // Prepare chart data for each assessment type
  const getChartData = useMemo(() => (type: AssessmentType) => {
    const typeAssessments = assessments
      .filter((a) => a.assessmentType === type)
      .sort((a, b) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime());

    const scoreKey = getPrimaryScoreKey(type);
    
    return typeAssessments.map((a) => ({
      date: format(new Date(a.assessmentDate), 'MMM d'),
      fullDate: a.assessmentDate,
      score: a.scores[scoreKey] || 0,
    }));
  }, [assessments, getPrimaryScoreKey]);

  // Calculate trend
  const getTrend = useMemo(() => (type: AssessmentType) => {
    const typeAssessments = assessments
      .filter((a) => a.assessmentType === type)
      .sort((a, b) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime());

    if (typeAssessments.length < 2) return null;

    const scoreKey = getPrimaryScoreKey(type);
    const first = typeAssessments[0].scores[scoreKey] || 0;
    const last = typeAssessments[typeAssessments.length - 1].scores[scoreKey] || 0;
    const change = last - first;

    // For NIHSS, lower is better (inverse trend)
    if (type === 'NIHSS') {
      if (change < -2) return 'improving';
      if (change > 2) return 'declining';
      return 'stable';
    }

    // For others, higher is better
    if (change > 2) return 'improving';
    if (change < -2) return 'declining';
    return 'stable';
  }, [assessments, getPrimaryScoreKey]);

  const getTrendIcon = (trend: string | null) => {
    if (!trend) return <Minus className="w-4 h-4" />;
    if (trend === 'improving') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendBadge = (trend: string | null) => {
    if (!trend) return null;
    const variant = trend === 'improving' ? 'default' : trend === 'declining' ? 'destructive' : 'secondary';
    return (
      <Badge variant={variant} className="ml-2">
        {getTrendIcon(trend)}
        <span className="ml-1 capitalize">{trend}</span>
      </Badge>
    );
  };

  const hasAnyData = assessments.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" aria-hidden="true" />
              Standardized Assessments
            </CardTitle>
            <CardDescription>
              Clinical outcome measures tracked over time
            </CardDescription>
          </div>
          <AddAssessmentDialog onAdd={addAssessment} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasAnyData && (
          <EmptyState
            icon={Activity}
            title="No assessments recorded yet"
            description="Add baseline assessments to track clinical outcomes over time. Use the 'Add Assessment' button above to get started."
            variant="info"
          />
        )}

        {groupedAssessments.map(({ type, assessments: typeAssessments }) => {
          if (typeAssessments.length === 0) return null;

          const chartData = getChartData(type);
          const trend = getTrend(type);
          const latest = typeAssessments[0];

          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium flex items-center">
                    {type}
                    {getTrendBadge(trend)}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Latest: {format(new Date(latest.assessmentDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge variant="outline">{typeAssessments.length} assessments</Badge>
              </div>

              {chartData.length > 1 && (
                <Suspense fallback={<div className="h-[150px] w-full bg-muted animate-pulse rounded" />}>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});

AssessmentTrendsCard.displayName = 'AssessmentTrendsCard';
