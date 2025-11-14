import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { useParserAnalytics } from '@/hooks/useParserAnalytics';
import { useTimeSeriesAnalytics } from '@/hooks/useTimeSeriesAnalytics';
import { AlertCircle, TrendingUp, Target, CheckCircle2, TrendingDown, Activity } from 'lucide-react';

const CONFIDENCE_COLORS = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#ef4444'
};

export function ParserAnalyticsDashboard() {
  const { analytics, isLoading, error } = useParserAnalytics();
  const { timeSeriesData, mechanismData, isLoading: tsLoading } = useTimeSeriesAnalytics(12);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load analytics: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) return null;

  const confidenceData = [
    { name: 'High', value: analytics.confidenceDistribution.high, color: CONFIDENCE_COLORS.high },
    { name: 'Medium', value: analytics.confidenceDistribution.medium, color: CONFIDENCE_COLORS.medium },
    { name: 'Low', value: analytics.confidenceDistribution.low, color: CONFIDENCE_COLORS.low }
  ];

  const fieldCorrectionData = analytics.topCorrectedFields.map(item => ({
    name: item.field,
    corrections: item.count,
    percentage: item.percentage
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Corrections</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalCorrections}</div>
            <p className="text-xs text-muted-foreground">
              User edits to AI predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.confidenceDistribution.high}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalCorrections > 0 
                ? Math.round((analytics.confidenceDistribution.high / analytics.totalCorrections) * 100) 
                : 0}% of corrections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Confidence</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.confidenceDistribution.medium}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalCorrections > 0 
                ? Math.round((analytics.confidenceDistribution.medium / analytics.totalCorrections) * 100) 
                : 0}% of corrections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.confidenceDistribution.low}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalCorrections > 0 
                ? Math.round((analytics.confidenceDistribution.low / analytics.totalCorrections) * 100) 
                : 0}% of corrections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Corrections by Field */}
        <Card>
          <CardHeader>
            <CardTitle>Corrections by Field</CardTitle>
            <CardDescription>
              Most frequently corrected fields (top 10)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fieldCorrectionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fieldCorrectionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="corrections" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No correction data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confidence Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Confidence Distribution</CardTitle>
            <CardDescription>
              AI confidence levels when corrections were made
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.totalCorrections > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={confidenceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {confidenceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No confidence data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Corrections */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Corrections</CardTitle>
          <CardDescription>
            Latest user corrections to AI predictions (up to 20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.recentCorrections.length > 0 ? (
            <div className="space-y-4">
              {analytics.recentCorrections.map((correction, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {correction.field_name.replace(/^impairments\./, '')}
                      </Badge>
                      {correction.confidence_before && (
                        <Badge 
                          variant={
                            correction.confidence_before === 'high' ? 'default' :
                            correction.confidence_before === 'medium' ? 'secondary' :
                            'destructive'
                          }
                        >
                          {correction.confidence_before} confidence
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(correction.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Original: </span>
                        <span className="text-muted-foreground">
                          {Array.isArray(correction.original_value) 
                            ? correction.original_value.join(', ') 
                            : String(correction.original_value)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Corrected: </span>
                        <span className="text-foreground">
                          {Array.isArray(correction.corrected_value) 
                            ? correction.corrected_value.join(', ') 
                            : String(correction.corrected_value)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No corrections recorded yet. Start using the AI parser to see analytics here.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Series: Parser Performance Trends */}
      {!tsLoading && timeSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Parser Performance Over Time
            </CardTitle>
            <CardDescription>
              Weekly trends in corrections and confidence calibration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="corrections" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Total Corrections"
                />
                <Line 
                  type="monotone" 
                  dataKey="correctionRate" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Error Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-sm text-muted-foreground mb-1">Avg Corrections/Week</div>
                <div className="text-2xl font-bold">
                  {Math.round(
                    timeSeriesData.reduce((sum, d) => sum + d.corrections, 0) / timeSeriesData.length
                  )}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-sm text-muted-foreground mb-1">Trend</div>
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  {timeSeriesData[timeSeriesData.length - 1]?.corrections < 
                   timeSeriesData[0]?.corrections ? (
                    <>
                      <TrendingDown className="w-5 h-5 text-green-600" />
                      <span className="text-green-600">Improving</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5 text-orange-600" />
                      <span className="text-orange-600">Rising</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-sm text-muted-foreground mb-1">Latest Error Rate</div>
                <div className="text-2xl font-bold">
                  {timeSeriesData[timeSeriesData.length - 1]?.correctionRate || 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confidence Distribution Over Time */}
      {!tsLoading && timeSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Confidence Calibration Trends</CardTitle>
            <CardDescription>
              How confidence levels correlate with corrections over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="highConfidence" 
                  stackId="1"
                  stroke={CONFIDENCE_COLORS.high}
                  fill={CONFIDENCE_COLORS.high}
                  name="High Confidence"
                />
                <Area 
                  type="monotone" 
                  dataKey="mediumConfidence" 
                  stackId="1"
                  stroke={CONFIDENCE_COLORS.medium}
                  fill={CONFIDENCE_COLORS.medium}
                  name="Medium Confidence"
                />
                <Area 
                  type="monotone" 
                  dataKey="lowConfidence" 
                  stackId="1"
                  stroke={CONFIDENCE_COLORS.low}
                  fill={CONFIDENCE_COLORS.low}
                  name="Low Confidence"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Mechanism-Specific Engagement */}
      {!tsLoading && mechanismData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mechanism-Based Session Engagement</CardTitle>
            <CardDescription>
              Completion rates and duration by stroke mechanism type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mechanismData.map((mechanism, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="capitalize">
                      {mechanism.mechanism.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm font-medium">
                      {mechanism.sessionCount} sessions
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Completion Rate</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${mechanism.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold">{mechanism.completionRate}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Avg Duration</div>
                      <div className="text-2xl font-bold">
                        {mechanism.avgDuration}
                        <span className="text-sm text-muted-foreground ml-1">min</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
