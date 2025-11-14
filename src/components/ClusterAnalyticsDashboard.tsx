import { useAdminResearchAnalytics } from '@/hooks/useAdminResearchAnalytics';
import { exportToCSV, downloadCSV } from '@/lib/exportClusterAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Users, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const ClusterAnalyticsDashboard = () => {
  const { data, loading, error } = useAdminResearchAnalytics();

  const handleExport = () => {
    if (!data) return;
    const csv = exportToCSV(data);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `cluster-analytics-${timestamp}.csv`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data || data.clusters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Cluster Data</CardTitle>
          <CardDescription>
            Insufficient data to generate cluster analytics. Users need complete clinical profiles.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Prepare chart data
  const adherenceData = data.clusters.map(cluster => ({
    name: `${cluster.clusterProfile.strokeMechanism.slice(0, 8)}_${cluster.clusterProfile.chronicity}`,
    sessions: cluster.metrics.sessionsPerWeek,
    cohortSize: cluster.metrics.cohortSize
  }));

  const accuracyData = data.clusters.map(cluster => ({
    name: `${cluster.clusterProfile.strokeMechanism.slice(0, 8)}_${cluster.clusterProfile.chronicity}`,
    accuracy: cluster.metrics.avgSessionAccuracy * 100,
    trend: cluster.metrics.improvementTrend * 100
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clinical Clusters</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.clusters.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.dataQualityScore * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Profile completeness</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Export</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} variant="outline" size="sm" className="w-full">
              Download CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Adherence Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Therapy Adherence by Cluster</CardTitle>
          <CardDescription>Average sessions per week across clinical profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={adherenceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis label={{ value: 'Sessions/Week', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Bar dataKey="sessions" fill="hsl(var(--primary))" name="Sessions/Week" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Accuracy & Improvement Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance & Improvement Trends</CardTitle>
          <CardDescription>Average accuracy and improvement rate per cluster</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={accuracyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" name="Avg Accuracy %" />
              <Line type="monotone" dataKey="trend" stroke="hsl(var(--chart-2))" name="Improvement Trend" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cluster Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cluster Details & Effective Strategies</CardTitle>
          <CardDescription>Top interventions and metrics for each clinical profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.clusters.map((cluster, idx) => (
              <Card key={idx} className="border-l-4 border-l-primary/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    {cluster.clusterProfile.strokeMechanism} | {cluster.clusterProfile.hemisphere} | {cluster.clusterProfile.lesionZone}
                  </CardTitle>
                  <CardDescription>
                    {cluster.clusterProfile.chronicity} phase • {cluster.metrics.cohortSize} users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Avg Accuracy</p>
                      <p className="text-lg font-semibold">{(cluster.metrics.avgSessionAccuracy * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Improvement Rate</p>
                      <p className="text-lg font-semibold">{(cluster.metrics.improvementTrend * 100).toFixed(2)}%/session</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Red Flag Rate</p>
                      <p className="text-lg font-semibold">{(cluster.metrics.redFlagRate * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  {cluster.topStrategies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm font-medium mb-2">Top Effective Strategies:</p>
                      <ul className="space-y-2">
                        {cluster.topStrategies.map((strategy, sIdx) => (
                          <li key={sIdx} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {strategy.name.replace(/_/g, ' ')} - {strategy.description}
                            </span>
                            <span className="font-medium text-primary">
                              {(strategy.effectivenessScore * 100).toFixed(0)}% ({strategy.sampleSize} samples)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
