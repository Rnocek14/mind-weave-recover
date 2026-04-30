import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, ShieldCheck, FileSignature } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { EligibilityScreeningForm } from '@/components/clinicalTrial/EligibilityScreeningForm';
import { ConsentSigningForm, type ConsentDocument } from '@/components/clinicalTrial/ConsentSigningForm';
import {
  DEFAULT_INCLUSION_CRITERIA,
  DEFAULT_EXCLUSION_CRITERIA,
  type EligibilityCriterion,
  type EnrollmentStatus,
} from '@/lib/clinicalTrial/types';

type Step = 'screening' | 'consent' | 'done' | 'ineligible';

export default function ClinicianTrialEnroll() {
  const { profileId } = useParams<{ profileId: string }>();
  const [searchParams] = useSearchParams();
  const studyId = searchParams.get('study');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studyName, setStudyName] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [patientUserId, setPatientUserId] = useState<string>('');
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus | null>(null);
  const [step, setStep] = useState<Step>('screening');
  const [inclusion, setInclusion] = useState<EligibilityCriterion[]>(DEFAULT_INCLUSION_CRITERIA);
  const [exclusion, setExclusion] = useState<EligibilityCriterion[]>(DEFAULT_EXCLUSION_CRITERIA);
  const [consentDoc, setConsentDoc] = useState<ConsentDocument | null>(null);

  useEffect(() => {
    if (!profileId || !studyId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, studyId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, profile_name, display_name')
        .eq('id', profileId!)
        .maybeSingle();
      if (!profile) {
        toast.error('Patient profile not found');
        navigate('/clinician/trial');
        return;
      }
      setPatientUserId(profile.user_id);
      setPatientName(profile.profile_name ?? profile.display_name ?? 'Patient');

      const { data: study } = await supabase
        .from('studies')
        .select('name, inclusion_criteria, exclusion_criteria')
        .eq('id', studyId!)
        .maybeSingle();
      if (!study) {
        toast.error('Study not found');
        navigate('/clinician/trial');
        return;
      }
      setStudyName(study.name);
      const inc = Array.isArray(study.inclusion_criteria) && study.inclusion_criteria.length > 0
        ? (study.inclusion_criteria as unknown as EligibilityCriterion[])
        : DEFAULT_INCLUSION_CRITERIA;
      const exc = Array.isArray(study.exclusion_criteria) && study.exclusion_criteria.length > 0
        ? (study.exclusion_criteria as unknown as EligibilityCriterion[])
        : DEFAULT_EXCLUSION_CRITERIA;
      setInclusion(inc);
      setExclusion(exc);

      // Existing enrollment?
      const { data: existing } = await supabase
        .from('study_enrollments')
        .select('id, status')
        .eq('study_id', studyId!)
        .eq('profile_id', profileId!)
        .maybeSingle();

      if (existing) {
        setEnrollmentId(existing.id);
        setEnrollmentStatus(existing.status as EnrollmentStatus);
        if (['active', 'consented', 'completed'].includes(existing.status)) {
          setStep('done');
        } else if (existing.status === 'eligible') {
          setStep('consent');
        } else if (existing.status === 'ineligible') {
          setStep('ineligible');
        }
      }

      // Latest consent doc
      const { data: docs } = await supabase
        .from('consent_documents')
        .select('id, version, title, body_md, plain_summary, audio_url')
        .order('version', { ascending: false })
        .limit(1);
      if (docs && docs[0]) {
        setConsentDoc(docs[0] as ConsentDocument);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScreeningSubmit = async (
    answers: Array<{ criterion: EligibilityCriterion; met: boolean; notes?: string }>,
    eligible: boolean,
  ) => {
    if (!user || !profileId || !studyId) return;
    setSubmitting(true);
    try {
      let enrollId = enrollmentId;
      if (!enrollId) {
        const { data: ins, error } = await supabase
          .from('study_enrollments')
          .insert({
            study_id: studyId,
            profile_id: profileId,
            user_id: patientUserId,
            status: eligible ? 'eligible' : 'ineligible',
            enrolled_by: user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        enrollId = ins.id;
        setEnrollmentId(enrollId);
      }

      const screeningRows = answers.map((a) => ({
        enrollment_id: enrollId!,
        criterion_kind: a.criterion.kind,
        criterion_key: a.criterion.key,
        criterion_label: a.criterion.label,
        met: a.met,
        notes: a.notes ?? null,
        screened_by: user.id,
      }));
      const { error: screenErr } = await supabase
        .from('eligibility_screenings')
        .insert(screeningRows);
      if (screenErr) throw screenErr;

      setEnrollmentStatus(eligible ? 'eligible' : 'ineligible');
      setStep(eligible ? 'consent' : 'ineligible');
      toast.success(eligible ? 'Screening saved — proceed to consent' : 'Screening saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save screening');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsentSign = async (sig: {
    signedName: string;
    capacityConfirmed: boolean;
    surrogateSignedName?: string;
    surrogateRelationship?: string;
  }) => {
    if (!user || !enrollmentId || !consentDoc) return;
    setSubmitting(true);
    try {
      const { error: cErr } = await supabase.from('consent_records').insert({
        enrollment_id: enrollmentId,
        consent_document_id: consentDoc.id,
        consent_version: consentDoc.version,
        signed_name: sig.signedName,
        ip_hash: null,
        user_agent: navigator.userAgent.slice(0, 500),
        capacity_confirmed_by: user.id,
        capacity_confirmed_at: new Date().toISOString(),
        surrogate_signed_name: sig.surrogateSignedName ?? null,
        surrogate_relationship: sig.surrogateRelationship ?? null,
        document_text_snapshot: consentDoc.body_md,
      });
      if (cErr) throw cErr;

      // Promote enrollment to active
      const { error: updErr } = await supabase
        .from('study_enrollments')
        .update({ status: 'active', enrolled_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (updErr) {
        console.warn('Enrollment status not advanced (append-only); admin must promote.', updErr);
      }
      setEnrollmentStatus('active');
      setStep('done');
      toast.success('Consent recorded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to record consent');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/clinician/trial')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to trial roster
        </Button>
        <h1 className="text-2xl font-bold mt-2">Enroll in {studyName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Patient: <strong>{patientName}</strong>
          {enrollmentStatus && (
            <Badge variant="outline" className="ml-2 capitalize">{enrollmentStatus}</Badge>
          )}
        </p>
      </div>

      {step === 'screening' && (
        <EligibilityScreeningForm
          inclusion={inclusion}
          exclusion={exclusion}
          onSubmit={handleScreeningSubmit}
          submitting={submitting}
        />
      )}

      {step === 'ineligible' && (
        <Alert variant="destructive">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            This patient does not meet the criteria for enrollment in <strong>{studyName}</strong>.
            They can still use the app outside the study.
          </AlertDescription>
        </Alert>
      )}

      {step === 'consent' && consentDoc && (
        <ConsentSigningForm
          document={consentDoc}
          patientName={patientName}
          onSign={handleConsentSign}
          submitting={submitting}
        />
      )}

      {step === 'consent' && !consentDoc && (
        <Alert variant="destructive">
          <FileSignature className="h-4 w-4" />
          <AlertDescription>
            No consent document is configured. An administrator must publish one before enrollment.
          </AlertDescription>
        </Alert>
      )}

      {step === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Enrollment complete
            </CardTitle>
            <CardDescription>
              {patientName} is enrolled in {studyName}. Their app will use the frozen trial engine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/clinician/trial')}>Return to roster</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
