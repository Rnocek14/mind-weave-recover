import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStandardizedAssessments, AssessmentType } from '@/hooks/useStandardizedAssessments';
import { AddAssessmentDialog } from './AddAssessmentDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface AssessmentTrendsCardProps {
  userId: string;
}

export const AssessmentTrendsCard = ({ userId }: AssessmentTrendsCardProps) => {
  const { assessments, loading, addAssessment } = useStandardizedAssessments(userId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const assessmentTypes: AssessmentType[] = ['WAB-R', 'BNT', 'NIHSS', 'ASHA-NOMS'];

  // Group assessments by type
  const groupedAssessments = assessmentTypes.map((type) => {
    const typeAssessments = assessments.filter((a) => a.assessmentType === type);
    return { type, assessments: typeAssessments };
  });

  // Get primary score key for each assessment type
  const getPrimaryScoreKey = (type: AssessmentType): string => {
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
  };

  // Prepare chart data for each assessment type
  const getChartData = (type: AssessmentType) => {
    const typeAssessments = assessments
      .filter((a) => a.assessmentType === type)
      .sort((a, b) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime());

    const scoreKey = getPrimaryScoreKey(type);
    
    return typeAssessments.map((a) => ({
      date: format(new Date(a.assessmentDate), 'MMM d'),
      fullDate: a.assessmentDate,
      score: a.scores[scoreKey] || 0,
    }));
  };

  // Calculate trend
  const getTrend = (type: AssessmentType) => {
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
  };

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
              <Activity className="w-5 h-5" />
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
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No assessments recorded yet</p>
            <p className="text-xs mt-1">Add baseline assessments to track clinical outcomes</p>
          </div>
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
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
