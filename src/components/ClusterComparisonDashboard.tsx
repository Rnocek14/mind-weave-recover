import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useClusterComparison } from '@/hooks/useClusterComparison';
import { 
  Users, TrendingUp, AlertCircle, Target, 
  Activity, Award, BarChart3 
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Line, LineChart, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface ClusterComparisonDashboardProps {
  userId: string;
  clinicalProfile: any;
}

export const ClusterComparisonDashboard = ({ userId, clinicalProfile }: ClusterComparisonDashboardProps) => {
  const { data, loading } = useClusterComparison(userId, clinicalProfile);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No cluster comparison data available</p>
          <p className="text-xs mt-1">Complete more sessions to see how you compare</p>
        </CardContent>
      </Card>
    );
  }

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'text-green-600';
    if (percentile >= 50) return 'text-blue-600';
    if (percentile >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPercentileBadge = (percentile: number) => {
    if (percentile >= 75) return { variant: 'default' as const, label: 'Top 25%' };
    if (percentile >= 50) return { variant: 'secondary' as const, label: 'Above Average' };
    if (percentile >= 25) return { variant: 'outline' as const, label: 'Below Average' };
    return { variant: 'destructive' as const, label: 'Bottom 25%' };
  };

  // Prepare radar chart data for overall comparison
  const radarData = [
    ...data.learningRates.slice(0, 4).map((lr) => ({
      subject: lr.domain,
      user: lr.percentile,
      fullMark: 100,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Your Cluster Profile
              </CardTitle>
              <CardDescription className="mt-2">
                Comparing your performance to {data.clusterSize} patients with similar stroke profiles
              </CardDescription>
            </div>
            <Badge {...getPercentileBadge(data.overallPercentile)}>
              {data.overallPercentile.toFixed(0)}th percentile overall
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Lesion Location</p>
              <p className="font-medium">{data.clusterProfile.lesionZone || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Stroke Type</p>
              <p className="font-medium capitalize">{data.clusterProfile.strokeMechanism || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time Since Stroke</p>
              <p className="font-medium capitalize">{data.clusterProfile.chronicity || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Hemisphere</p>
              <p className="font-medium capitalize">{data.clusterProfile.hemisphere || 'Not specified'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Rates Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Learning Rate Comparison
          </CardTitle>
          <CardDescription>
            Your learning velocity vs. cluster statistics across cognitive domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.learningRates}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="domain" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'Accuracy Slope', angle: -90, position: 'insideLeft', fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'userSlope') return [value.toFixed(3), 'Your Rate'];
                  if (name === 'clusterMedian') return [value.toFixed(3), 'Cluster Median'];
                  return [value, name];
                }}
              />
              <Bar dataKey="clusterP25" fill="hsl(var(--muted))" name="P25" />
              <Bar dataKey="clusterMedian" fill="hsl(var(--muted-foreground))" name="Median" />
              <Bar dataKey="clusterP75" fill="hsl(var(--muted))" name="P75" />
              <Bar dataKey="userSlope" fill="hsl(var(--primary))" name="Your Rate" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-3">
            {data.learningRates.map((lr) => {
              const badge = getPercentileBadge(lr.percentile);
              return (
                <div key={lr.domain} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{lr.domain}</span>
                      <Badge variant={badge.variant} className="ml-2">
                        {lr.percentile.toFixed(0)}th
                      </Badge>
                    </div>
                    <Progress value={lr.percentile} className="h-2" />
                  </div>
                  <span className="ml-4 text-xs text-muted-foreground">
                    {lr.userCount} users
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error Patterns */}
      {data.errorPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Error Pattern Analysis
            </CardTitle>
            <CardDescription>
              Your error distribution compared to cluster averages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.errorPatterns} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  dataKey="errorType" 
                  type="category" 
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => (value * 100).toFixed(1) + '%'}
                />
                <Bar dataKey="clusterAvg" fill="hsl(var(--muted-foreground))" name="Cluster Avg" />
                <Bar dataKey="userRate" fill="hsl(var(--primary))" name="Your Rate" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Assessment Scores */}
      {data.assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Standardized Assessment Scores
            </CardTitle>
            <CardDescription>
              Your latest scores vs. cluster averages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.assessments.map((assessment) => {
                const badge = getPercentileBadge(assessment.percentile);
                return (
                  <div key={assessment.assessmentType} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{assessment.assessmentType}</p>
                        <p className="text-xs text-muted-foreground">
                          Latest: {new Date(assessment.scoreDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Your Score</p>
                        <p className="text-2xl font-bold">{assessment.userLatestScore}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cluster Average</p>
                        <p className="text-2xl font-bold text-muted-foreground">
                          {assessment.clusterAvg}
                        </p>
                      </div>
                    </div>
                    <Progress value={assessment.percentile} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal Achievement */}
      {data.goalAchievement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Goal Achievement Rate
            </CardTitle>
            <CardDescription>
              Functional goal success compared to similar patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.goalAchievement.map((goal) => (
                <div key={goal.domain} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{goal.domain}</span>
                    <span className="text-sm text-muted-foreground">
                      {(goal.userAchievementRate * 100).toFixed(0)}% achieved
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Progress value={goal.userAchievementRate * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">Your Rate</p>
                    </div>
                    <div>
                      <Progress 
                        value={goal.clusterAvg * 100} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Cluster Avg</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Performance Radar */}
      {radarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Overall Performance Profile
            </CardTitle>
            <CardDescription>
              Your percentile ranking across all measured domains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fontSize: 12 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Your Percentile"
                  dataKey="user"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => value.toFixed(0) + 'th percentile'}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
