import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePatientProgressAnalytics } from '@/hooks/usePatientProgressAnalytics';
import { AlertCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface PatientProgressDashboardProps {
  userId: string | undefined;
}

export function PatientProgressDashboard({ userId }: PatientProgressDashboardProps) {
  const { progressData, domainTrends, isLoading, error } = usePatientProgressAnalytics(userId, 8);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load progress analytics: {error}</AlertDescription>
      </Alert>
    );
  }

  if (progressData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            No exercise data yet. Complete some sessions to see your progress here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain Trends Summary */}
      {domainTrends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {domainTrends.map((trend, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{trend.domain} Domain</span>
                  <Badge variant={trend.improvement >= 0 ? "default" : "secondary"}>
                    {trend.improvement >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(trend.improvement)}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Accuracy</span>
                    <span className="font-bold">{trend.currentAccuracy}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Previous Period</span>
                    <span>{trend.previousAccuracy}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trials</span>
                    <span>{trend.trialCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Accuracy Trends Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Accuracy Trends by Domain
          </CardTitle>
          <CardDescription>
            Weekly performance across motor and speech exercises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              {progressData.some(d => d.motor_accuracy !== undefined) && (
                <Line 
                  type="monotone" 
                  dataKey="motor_accuracy" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Motor Accuracy %"
                  connectNulls
                />
              )}
              {progressData.some(d => d.speech_accuracy !== undefined) && (
                <Line 
                  type="monotone" 
                  dataKey="speech_accuracy" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Speech Accuracy %"
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Reaction Time Trends */}
      {progressData.some(d => d.motor_rt || d.speech_rt) && (
        <Card>
          <CardHeader>
            <CardTitle>Reaction Time Trends</CardTitle>
            <CardDescription>
              Response speed improvements over time (lower is better)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {progressData.some(d => d.motor_rt !== undefined) && (
                  <Line 
                    type="monotone" 
                    dataKey="motor_rt" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Motor RT (ms)"
                    connectNulls
                  />
                )}
                {progressData.some(d => d.speech_rt !== undefined) && (
                  <Line 
                    type="monotone" 
                    dataKey="speech_rt" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Speech RT (ms)"
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
