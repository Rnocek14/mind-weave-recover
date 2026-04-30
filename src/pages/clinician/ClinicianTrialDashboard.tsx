import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClipboardList, Users, ShieldCheck, ArrowLeft, FileSignature } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { EnrollmentStatus, StudyStatus } from '@/lib/clinicalTrial/types';
import { format } from 'date-fns';

interface StudyRow {
  id: string;
  name: string;
  status: StudyStatus;
  target_enrollment: number | null;
  started_at: string | null;
}

interface EnrollmentRow {
  id: string;
  study_id: string;
  profile_id: string;
  status: EnrollmentStatus;
  enrolled_at: string | null;
  profile_name: string | null;
}

const STATUS_VARIANT: Record<EnrollmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  screening: 'outline',
  eligible: 'secondary',
  ineligible: 'destructive',
  consented: 'secondary',
  active: 'default',
  withdrawn: 'destructive',
  completed: 'secondary',
};

export default function ClinicianTrialDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isLoading: permLoading } = useUserPermissions(user?.id);
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: studyData } = await supabase
        .from('studies')
        .select('id, name, status, target_enrollment, started_at')
        .order('started_at', { ascending: false, nullsFirst: false });

      const { data: enrollData } = await supabase
        .from('study_enrollments')
        .select('id, study_id, profile_id, status, enrolled_at, profiles(profile_name)')
        .order('enrolled_at', { ascending: false, nullsFirst: false });

      setStudies((studyData ?? []) as StudyRow[]);
      setEnrollments(
        (enrollData ?? []).map((e: any) => ({
          id: e.id,
          study_id: e.study_id,
          profile_id: e.profile_id,
          status: e.status,
          enrolled_at: e.enrolled_at,
          profile_name: e.profiles?.profile_name ?? null,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  if (permLoading || loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const activeStudies = studies.filter((s) => s.status === 'active');
  const draftStudies = studies.filter((s) => s.status === 'draft');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/clinician/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to caseload
          </Button>
          <h1 className="text-3xl font-bold mt-2 flex items-center gap-2">
            <ClipboardList className="h-7 w-7" />
            Clinical Trial
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Roster, eligibility, and consent for active feasibility pilots.
          </p>
        </div>
      </div>

      {activeStudies.length === 0 && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            No active studies. {isAdmin
              ? 'Create a study from the admin panel to begin enrolling patients.'
              : 'Ask an administrator to activate a study before enrolling patients.'}
            {draftStudies.length > 0 && ` (${draftStudies.length} draft study/studies pending.)`}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">
            <Users className="h-4 w-4 mr-2" />
            Roster
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Triage — who's enrolled, who's screening, who needs consent?
          </p>

          {activeStudies.map((study) => {
            const studyEnrollments = enrollments.filter((e) => e.study_id === study.id);
            return (
              <Card key={study.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{study.name}</CardTitle>
                      <CardDescription>
                        {studyEnrollments.length}
                        {study.target_enrollment ? ` / ${study.target_enrollment}` : ''} enrolled ·
                        started {study.started_at ? format(new Date(study.started_at), 'MMM d, yyyy') : '—'}
                      </CardDescription>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {studyEnrollments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No patients enrolled yet. Open a patient hub and use Enroll in study.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {studyEnrollments.map((e) => (
                        <div key={e.id} className="flex items-center justify-between py-3">
                          <div>
                            <p className="font-medium">{e.profile_name ?? 'Unnamed patient'}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.enrolled_at
                                ? `Enrolled ${format(new Date(e.enrolled_at), 'MMM d, yyyy')}`
                                : 'Pre-enrollment'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={STATUS_VARIANT[e.status]} className="capitalize">
                              {e.status}
                            </Badge>
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/clinician/trial/enroll/${e.profile_id}?study=${study.id}`}>
                                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                                Open
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
