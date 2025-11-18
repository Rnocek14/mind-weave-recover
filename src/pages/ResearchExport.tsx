import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useResearchExport } from '@/hooks/useResearchExport';
import { DataDictionary } from '@/components/DataDictionary';
import { 
  Database, Download, Users, Activity, Target, 
  FileText, TrendingUp, BarChart3, ShieldCheck, Loader2 
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const ResearchExport = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [cohortStats, setCohortStats] = useState<any>(null);
  
  const {
    loading,
    getCohortStatistics,
    exportDemographics,
    exportSessions,
    exportTrials,
    exportLearningRates,
    exportGoals,
    exportGoalRatings,
    exportAssessments,
  } = useResearchExport();

  useEffect(() => {
    const checkAdminAndLoadData = async () => {
      if (!user) {
        if (!authLoading) navigate('/auth');
        return;
      }

      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const adminStatus = roles?.some((r) => r.role === 'admin') || false;
        setIsAdmin(adminStatus);

        if (!adminStatus) {
          navigate('/');
          return;
        }

        // Load cohort statistics
        const stats = await getCohortStatistics();
        setCohortStats(stats);
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/');
      } finally {
        setCheckingAdmin(false);
      }
    };

    void checkAdminAndLoadData();
  }, [user, authLoading, navigate]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8" />
            Research Data Export
          </h1>
          <p className="text-muted-foreground mt-1">
            De-identified cohort data for research and analysis
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <ShieldCheck className="w-4 h-4 mr-1" />
          Admin Only
        </Badge>
      </div>

      {/* Cohort Statistics */}
      {cohortStats && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Cohort Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{cohortStats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {cohortStats.totalSessions} sessions · {cohortStats.totalTrials.toLocaleString()} trials
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {cohortStats.avgSessionsPerUser.toFixed(1)} sessions/user
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Lesion Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(cohortStats.lesionDistribution)
                  .slice(0, 3)
                  .map(([location, count]) => (
                    <div key={location} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate">{location}</span>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Avg Learning Rates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(cohortStats.avgLearningRates)
                  .slice(0, 3)
                  .map(([domain, rate]) => (
                    <div key={domain} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{domain}</span>
                      <span className="font-medium">
                        {(rate as number).toFixed(3)}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Data Exports
          </CardTitle>
          <CardDescription>
            Download de-identified datasets as CSV files. All exports remove direct identifiers (user IDs, names) while preserving linkage via hashed IDs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="justify-start h-auto py-4"
              onClick={exportDemographics}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <Users className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Demographics</div>
                  <div className="text-xs text-muted-foreground">
                    Participant profiles, stroke details, clinical severity
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4"
              onClick={exportSessions}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <Activity className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Sessions</div>
                  <div className="text-xs text-muted-foreground">
                    Session metadata, duration, mood, summary metrics
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4"
              onClick={exportTrials}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <BarChart3 className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Exercise Trials</div>
                  <div className="text-xs text-muted-foreground">
                    Trial-level performance: accuracy, RT, cues, errors
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4"
              onClick={exportLearningRates}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <TrendingUp className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Learning Rates</div>
                  <div className="text-xs text-muted-foreground">
                    Longitudinal learning trajectories by domain
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4"
              onClick={exportGoals}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <Target className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Functional Goals</div>
                  <div className="text-xs text-muted-foreground">
                    User-defined rehabilitation goals (may contain PII)
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4"
              onClick={exportGoalRatings}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <FileText className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Goal Progress Ratings</div>
                  <div className="text-xs text-muted-foreground">
                    Weekly goal progress check-ins and ratings
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 md:col-span-2"
              onClick={exportAssessments}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <FileText className="w-5 h-5 mt-0.5" />
                <div className="text-left flex-1">
                  <div className="font-medium">Standardized Assessments</div>
                  <div className="text-xs text-muted-foreground">
                    WAB-R, BNT, NIHSS, ASHA-NOMS scores over time
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Button>
          </div>

          <Separator />

          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p className="font-medium">⚠️ Data Use Guidelines</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>All exports use hashed IDs to preserve anonymity while enabling cross-table linkage</li>
              <li>Free-text fields (goal descriptions, notes) may contain PII - review before external sharing</li>
              <li>This data is for research purposes only - ensure IRB approval before publication</li>
              <li>Do not attempt to re-identify participants</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Data Dictionary */}
      <DataDictionary />
    </div>
  );
};

export default ResearchExport;
