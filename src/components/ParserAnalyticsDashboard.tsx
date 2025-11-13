import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useParserAnalytics } from '@/hooks/useParserAnalytics';
import { AlertCircle, TrendingUp, Target, CheckCircle2 } from 'lucide-react';

const CONFIDENCE_COLORS = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#ef4444'
};

export function ParserAnalyticsDashboard() {
  const { analytics, isLoading, error } = useParserAnalytics();

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
    </div>
  );
}
