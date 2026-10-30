import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, ShieldCheck, ShieldAlert, Volume2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import {
  enrollSpeakerSample, getSpeakerEnrollmentStatus, getSpeakerChecks,
  getSpeakerReviewAudio, pollSpeakerCheck, pollSpeakerEnrollment,
  revokeSpeakerEnrollment, saveSpeakerReview,
  type EnrollmentStatus, type SpeakerIntegrityCheck,
} from '@/lib/speech/speakerIntegrityClient';

interface Props {
  profileId: string | null;
}

/**
 * Account-owner pilot panel. Always behind the opt-in build flag; the Edge
 * handler separately requires explicit consent, ownership and a server flag.
 * Not a patient login or identity-proofing feature.
 */
export function SpeakerIntegrityPanel({ profileId }: Props) {
  const { isRecording, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const [status, setStatus] = useState<EnrollmentStatus>('unavailable');
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [samples, setSamples] = useState<SpeakerIntegrityCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [playingCheck, setPlayingCheck] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [reviewLabel, setReviewLabel] = useState<'patient' | 'other' | 'mixed' | 'uncertain'>('uncertain');
  const startedAtRef = useRef<number | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timers must call the CURRENT recorder closure after React applies
  // isRecording=true. Otherwise an old isRecording=false closure does nothing.
  const finishSampleRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const status = await getSpeakerEnrollmentStatus(profileId);
      setEnabled(status.enabled === true);
      setStatus(status.status ?? 'unavailable');
      if (status.enabled && status.status === 'ready') {
        setSamples(await getSpeakerChecks(profileId));
      } else {
        setSamples([]);
      }
    } catch {
      setEnabled(false);
      setStatus('unavailable');
    }
  }, [profileId]);

  useEffect(() => {
    setStatus('unavailable');
    setEnabled(false);
    setSamples([]);
    setPlayingCheck(null);
    setAudioUrl(null);
    void load();
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      cancelRecording();
    };
  }, [load, cancelRecording]);

  useEffect(() => {
    if (!profileId || status !== 'pending') return;
    let cancelled = false;
    let polls = 0;
    const interval = setInterval(() => {
      if (polls++ >= 20) {
        clearInterval(interval);
        return;
      }
      void pollSpeakerEnrollment(profileId).then((result) => {
        if (!cancelled) {
          setStatus(result.status ?? 'unavailable');
          if (result.status === 'ready') void load();
        }
      }).catch(() => {
        if (!cancelled) setMessage('Enrollment is still pending. Try Refresh later.');
      });
    }, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [profileId, status, load]);

  const refresh = async () => {
    if (!profileId) return;
    setBusy(true);
    try {
      if (status === 'pending') await pollSpeakerEnrollment(profileId);
      const pending = samples.filter(s => s.status === 'pending');
      await Promise.all(pending.slice(0, 8).map(s => pollSpeakerCheck(profileId, s.id)));
      await load();
      setMessage('');
    } catch {
      setMessage('Could not refresh voice checks.');
    } finally { setBusy(false); }
  };

  const finishSample = async () => {
    if (!profileId || !isRecording || busy) return;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    const result = await stopRecording();
    if (!result) { setMessage('No sample captured.'); return; }
    setBusy(true);
    setMessage('Preparing voice enrollment…');
    try {
      await enrollSpeakerSample(profileId, result.audioBlob, result.duration, consent);
      setStatus('pending');
      setMessage('Sample submitted. Speaker enrollment is pending.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enroll voice.');
    } finally {
      setBusy(false);
      startedAtRef.current = null;
    }
  };

  finishSampleRef.current = finishSample;

  const startSample = async () => {
    if (!profileId || busy || !consent) return;
    setMessage('');
    const ok = await startRecording();
    if (!ok) { setMessage('Microphone unavailable.'); return; }
    startedAtRef.current = Date.now();
    // Make it possible for a caregiver to stop early, but never allow a
    // runaway recording. ~15 seconds is friendlier than a 30s upper bound.
    autoStopRef.current = setTimeout(() => {
      void finishSampleRef.current();
    }, 15_000);
  };

  const revoke = async () => {
    if (!profileId || busy) return;
    if (!window.confirm('Remove this patient voiceprint and all shadow speaker checks?')) return;
    setBusy(true);
    try {
      await revokeSpeakerEnrollment(profileId);
      setStatus('revoked');
      setSamples([]);
      setAudioUrl(null);
      setPlayingCheck(null);
      setConsent(false);
      setMessage('Voiceprint and speaker checks removed.');
    } catch {
      setMessage('Could not remove voiceprint. Please retry.');
    } finally { setBusy(false); }
  };

  const reviewAudio = async (checkId: string) => {
    if (!profileId) return;
    setBusy(true);
    try {
      const url = await getSpeakerReviewAudio(profileId, checkId);
      if (!url) throw new Error('Unavailable');
      setAudioUrl(url);
      setPlayingCheck(checkId);
      setReviewLabel(samples.find(s => s.id === checkId)?.manualReviewLabel ?? 'uncertain');
    } catch {
      setMessage('Unable to retrieve the private recording.');
    } finally { setBusy(false); }
  };

  const saveReview = async () => {
    if (!profileId || !playingCheck) return;
    setBusy(true);
    try {
      await saveSpeakerReview(profileId, playingCheck, reviewLabel);
      await load();
      setMessage('Human review saved separately; clinical scores are unchanged.');
    } catch {
      setMessage('Could not save the review label.');
    } finally { setBusy(false); }
  };

  if (!profileId) return null;
  return (
    <section aria-label="Speaker integrity research pilot" className="rounded-xl border p-4 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 mt-1 text-muted-foreground" aria-hidden />
        <div className="flex-1 space-y-1">
          <h2 className="font-semibold">Speaker integrity · Research pilot</h2>
          <p className="text-sm text-muted-foreground">
            An optional voice comparison for identifying patient, caregiver, and mixed speech.
            These results are exploratory and <strong>never change therapy scores or clinical progression.</strong>
          </p>
        </div>
      </div>
      {!enabled ? (
        <p role="status" className="text-sm text-muted-foreground">
          The speaker pilot is currently unavailable. It requires approved secure processing and a separately enabled server.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">Voice enrollment: <strong>{status.replaceAll('_', ' ')}</strong></p>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden /> Refresh
            </Button>
          </div>
          {status !== 'ready' && status !== 'pending' && (
            <div className="space-y-3 rounded-lg bg-muted/30 p-3">
              <p className="text-sm">
                An account owner may record a single-speaker voice sample only after confirming the patient's
                permission or applicable legal authorization. The recording is sent to the configured speech
                provider for a voiceprint. NeuroSpark stores only an encrypted voiceprint and consent metadata.
                Record natural speech for at least 5 seconds, ideally about 10–15.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
                <span>I confirm consent or legal authorization for biometric voice analysis, and that the sample contains only this patient.</span>
              </label>
              <Button
                onClick={() => void (isRecording ? finishSample() : startSample())}
                disabled={busy || (!isRecording && !consent)}
                variant={isRecording ? 'destructive' : 'default'}
              >
                {isRecording ? <><Square className="mr-2 h-4 w-4" aria-hidden /> Stop voice sample</> :
                  <><Mic className="mr-2 h-4 w-4" aria-hidden /> Record voice sample</>}
              </Button>
              {isRecording && <p role="status" className="text-sm">Recording only the patient's voice. Stop after 5–15 seconds.</p>}
            </div>
          )}
          {status === 'pending' && <p role="status" className="text-sm">Voiceprint processing. Refresh if it does not complete automatically.</p>}
          {status === 'ready' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Shadow reviews are queued after supported speech attempts. Short or uncertain utterances must not be treated as patient failure.
                Audio is reviewed through temporary, patient-scoped access.
              </p>
              {samples.length === 0 ? <p className="text-sm">No speaker checks yet.</p> : (
                <div className="space-y-2">
                  {samples.map((s) => (
                    <div key={s.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <strong>{s.status === 'pending' ? 'Verification pending' : (s.label ?? 'Uncertain').replaceAll('_', ' ')}</strong>
                          <span className="text-muted-foreground ml-2">{new Date(s.createdAt).toLocaleString()}</span>
                        </div>
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => void reviewAudio(s.id)}>
                          <Volume2 className="h-4 w-4 mr-1" aria-hidden /> Listen
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.observedSpeakers === null ? 'No completed identification yet.' :
                          s.observedSpeakers + ' speaker(s) detected. Match is advisory only.'}
                        {s.manualReviewLabel && ' • Human label: ' + s.manualReviewLabel}
                      </p>
                      {playingCheck === s.id && audioUrl && (
                        <div className="space-y-2">
                          <audio controls src={audioUrl} className="w-full" aria-label="Private recorded attempt" />
                          <label className="text-sm flex flex-wrap items-center gap-2">
                            What did you hear?
                            <select aria-label="Human speaker review" value={reviewLabel}
                              onChange={(e) => setReviewLabel(e.target.value as typeof reviewLabel)}
                              className="border rounded p-1 bg-background">
                              <option value="uncertain">Unsure</option>
                              <option value="patient">Only patient</option>
                              <option value="other">Other speaker</option>
                              <option value="mixed">Multiple speakers</option>
                            </select>
                          </label>
                          <Button size="sm" onClick={() => void saveReview()} disabled={busy}>Save review</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {status === 'ready' && (
            <Button variant="outline" size="sm" onClick={() => void revoke()} disabled={busy}>
              Remove voiceprint and shadow checks
            </Button>
          )}
          {message && <p role="status" className="text-sm flex items-center gap-2"><ShieldAlert aria-hidden className="h-4 w-4" />{message}</p>}
        </>
      )}
    </section>
  );
}
