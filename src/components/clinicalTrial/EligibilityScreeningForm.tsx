import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { EligibilityCriterion } from '@/lib/clinicalTrial/types';

interface Props {
  inclusion: EligibilityCriterion[];
  exclusion: EligibilityCriterion[];
  onSubmit: (
    answers: Array<{ criterion: EligibilityCriterion; met: boolean; notes?: string }>,
    eligible: boolean,
  ) => Promise<void> | void;
  submitting?: boolean;
}

/**
 * Clinician-facing eligibility screening form. Renders inclusion + exclusion
 * criteria, derives final eligibility:
 *   eligible = ALL inclusion met AND ZERO exclusion met
 */
export function EligibilityScreeningForm({ inclusion, exclusion, onSubmit, submitting }: Props) {
  const all = [...inclusion, ...exclusion];
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const allAnswered = all.every((c) => typeof answers[c.key] === 'boolean');

  const inclusionMet = inclusion.every((c) => answers[c.key] === true);
  const exclusionTriggered = exclusion.some((c) => answers[c.key] === true);
  const eligible = allAnswered && inclusionMet && !exclusionTriggered;

  const renderGroup = (group: EligibilityCriterion[], heading: string) => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      {group.map((c) => (
        <div key={c.key} className="rounded-lg border p-4 space-y-3">
          <div>
            <Label className="text-base font-medium leading-snug">{c.label}</Label>
            {c.hint && <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>}
          </div>
          <RadioGroup
            value={answers[c.key] === undefined ? '' : answers[c.key] ? 'yes' : 'no'}
            onValueChange={(v) => setAnswers((prev) => ({ ...prev, [c.key]: v === 'yes' }))}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${c.key}-yes`} />
              <Label htmlFor={`${c.key}-yes`} className="cursor-pointer font-normal">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${c.key}-no`} />
              <Label htmlFor={`${c.key}-no`} className="cursor-pointer font-normal">No</Label>
            </div>
          </RadioGroup>
          <Textarea
            placeholder="Notes (optional)"
            value={notes[c.key] ?? ''}
            onChange={(e) => setNotes((prev) => ({ ...prev, [c.key]: e.target.value }))}
            className="text-sm"
            rows={2}
            maxLength={500}
          />
        </div>
      ))}
    </div>
  );

  const handleSubmit = async () => {
    const payload = all.map((c) => ({
      criterion: c,
      met: answers[c.key] === true,
      notes: notes[c.key]?.trim() || undefined,
    }));
    await onSubmit(payload, eligible);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eligibility screening</CardTitle>
        <CardDescription>
          Mark each criterion based on the patient's record and your clinical judgment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderGroup(inclusion, 'Inclusion — all must be Yes')}
        {renderGroup(exclusion, 'Exclusion — none should be Yes')}

        {allAnswered && (
          <Alert variant={eligible ? 'default' : 'destructive'}>
            {eligible ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>
              {eligible
                ? 'Patient meets all criteria. Ready to proceed to consent.'
                : !inclusionMet
                  ? 'Patient does not meet all inclusion criteria — cannot enroll in this study.'
                  : 'A documented exclusion criterion was met — cannot enroll in this study.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!allAnswered || submitting}>
            {submitting ? 'Saving…' : 'Save screening'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
