import { useState } from 'react';
import { useRiskScoring } from '@/hooks/useRiskScoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, TrendingDown, Activity, UserX, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const RiskScoringDashboard = () => {
  const { users, loading, error } = useRiskScoring();
  const [filterRisk, setFilterRisk] = useState<'all' | 'dropout' | 'plateau' | 'regression'>('all');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
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

  // Filter users based on selected risk type
  const filteredUsers = users.filter(user => {
    if (filterRisk === 'all') return true;
    if (filterRisk === 'dropout') return user.riskFactors.dropoutRisk >= 0.5;
    if (filterRisk === 'plateau') return user.riskFactors.plateauRisk >= 0.5;
    if (filterRisk === 'regression') return user.riskFactors.regressionRisk >= 0.5;
    return true;
  });

  const criticalUsers = users.filter(u => u.priority === 'critical').length;
  const highRiskUsers = users.filter(u => u.priority === 'high').length;
  const mediumRiskUsers = users.filter(u => u.priority === 'medium').length;

  const getRiskColor = (risk: number) => {
    if (risk >= 0.7) return 'text-red-600';
    if (risk >= 0.5) return 'text-orange-600';
    if (risk >= 0.3) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-600">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-600">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Risk</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalUsers}</div>
            <p className="text-xs text-muted-foreground">Immediate action needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highRiskUsers}</div>
            <p className="text-xs text-muted-foreground">Close monitoring</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Risk</CardTitle>
            <Activity className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mediumRiskUsers}</div>
            <p className="text-xs text-muted-foreground">Preventive measures</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Being monitored</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Type Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Analysis by Type</CardTitle>
          <CardDescription>
            Filter users by specific risk categories for targeted intervention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={filterRisk} onValueChange={(v) => setFilterRisk(v as any)}>
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="all">All Users</TabsTrigger>
              <TabsTrigger value="dropout">Dropout Risk</TabsTrigger>
              <TabsTrigger value="plateau">Plateau Risk</TabsTrigger>
              <TabsTrigger value="regression">Regression Risk</TabsTrigger>
            </TabsList>

            <TabsContent value={filterRisk} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Risk Scores</TableHead>
                    <TableHead>Key Indicators</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No users found for this risk category
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.displayName}</TableCell>
                        <TableCell>{getPriorityBadge(user.priority)}</TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20">Dropout:</span>
                              <Progress 
                                value={user.riskFactors.dropoutRisk * 100} 
                                className="w-24 h-2" 
                              />
                              <span className={`text-xs font-medium ${getRiskColor(user.riskFactors.dropoutRisk)}`}>
                                {(user.riskFactors.dropoutRisk * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20">Plateau:</span>
                              <Progress 
                                value={user.riskFactors.plateauRisk * 100} 
                                className="w-24 h-2" 
                              />
                              <span className={`text-xs font-medium ${getRiskColor(user.riskFactors.plateauRisk)}`}>
                                {(user.riskFactors.plateauRisk * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20">Regression:</span>
                              <Progress 
                                value={user.riskFactors.regressionRisk * 100} 
                                className="w-24 h-2" 
                              />
                              <span className={`text-xs font-medium ${getRiskColor(user.riskFactors.regressionRisk)}`}>
                                {(user.riskFactors.regressionRisk * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.indicators.sessionFrequencyDecline && (
                              <Badge variant="secondary" className="text-xs">Freq ↓</Badge>
                            )}
                            {user.indicators.lowRecentAdherence && (
                              <Badge variant="secondary" className="text-xs">Low Adherence</Badge>
                            )}
                            {user.indicators.performanceDecline && (
                              <Badge variant="secondary" className="text-xs">Perf ↓</Badge>
                            )}
                            {user.indicators.flatProgress && (
                              <Badge variant="secondary" className="text-xs">Flat</Badge>
                            )}
                            {user.indicators.highErrorRate && (
                              <Badge variant="secondary" className="text-xs">High Errors</Badge>
                            )}
                            {user.indicators.increasingCueDependence && (
                              <Badge variant="secondary" className="text-xs">Cue ↑</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.sessionCount}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {user.lastSessionDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span className={user.indicators.daysSinceLastSession > 14 ? 'text-red-600 font-semibold' : ''}>
                                {formatDistanceToNow(new Date(user.lastSessionDate), { addSuffix: true })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-red-600 font-semibold">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          {user.recommendation}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
