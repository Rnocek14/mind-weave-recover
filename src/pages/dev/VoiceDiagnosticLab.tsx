import { useCallback, useRef, useState } from 'react';
import { usePronunciationAnalysis, type PronunciationResult } from '@/hooks/usePronunciationAnalysis';
import { scoreAudioCase } from '@/lib/clinicalSimulation/audioBenchmark';
import { wordContainsPhoneme } from '@/lib/phonemeWordMap';

type Run = {
  id: string; reference: string; target: string; fileName: string;
  result: PronunciationResult; transcript: string | null;
  wer: number | null; exact: boolean | null; durationMs: number;
};

/** Admin-only QA tool. Analysis requests go to the existing Azure edge function.
 * No patient profile, exercise event, or progression state is written.
 */
export default function VoiceDiagnosticLab() {
  const [target, setTarget] = useState('red');
  const [reference, setReference] = useState('red');
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const { analyzePronunciation } = usePronunciationAnalysis();

  const analyze = useCallback(async (audio: Blob, name: string) => {
    if (!target.trim() || !reference.trim()) { setError('Enter the target and the known spoken words.'); return; }
    setBusy(true); setError(null);
    const start = performance.now();
    try {
      const result = await analyzePronunciation(audio, target.trim());
      const transcript = result.ok ? result.data.transcript : null;
      const scored = scoreAudioCase({
        caseId: crypto.randomUUID(), sourceId: 'local-qa',
        referenceTranscript: reference.trim(), recognizedTranscript: transcript,
        condition: 'other', eligibleForAccuracy: true, expectedSpeaker: 'unknown',
      });
      const normalized = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\\s+/g, ' ');
      setRuns(previous => [{
        id: scored.caseId, reference: reference.trim(), target: target.trim(),
        fileName: name, result, transcript, wer: scored.wer,
        exact: transcript === null ? null : normalized(transcript) === normalized(reference),
        durationMs: Math.round(performance.now() - start),
      }, ...previous]);
      if (!result.ok) setError(result.error.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [analyzePronunciation, reference, target]);

  const startMic = async () => {
    try {
      setError(null);
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = audioStream;
      const chunks: BlobPart[] = [];
      const mr = new MediaRecorder(audioStream);
      recorder.current = mr;
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        audioStream.getTracks().forEach(t => t.stop());
        stream.current = null; recorder.current = null; setRecording(false);
        void analyze(blob, 'microphone-recording');
      };
      mr.start(); setRecording(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const stopMic = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  const exportJson = () => {
    const payload = runs.map(({ result, ...rest }) => ({
      ...rest,
      azure: result.ok ? result.data : { error: result.error, timings: result.timingsMs },
    }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'voice-diagnostic-runs.json'; link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-5">
      <h1 className="text-3xl font-bold">Voice Diagnostic Lab</h1>
      <p className="text-sm text-muted-foreground">Admin-only, test branch. Real audio → existing Azure pronunciation endpoint → reference comparison. No clinical profile or game events are updated.</p>
      <div className="rounded-lg border p-4 grid gap-3">
        <label>Game target / Azure reference text
          <input className="w-full rounded border bg-background p-2" value={target} onChange={e => setTarget(e.target.value)} />
        </label>
        <label>Known words actually spoken (independent ground truth)
          <input className="w-full rounded border bg-background p-2" value={reference} onChange={e => setReference(e.target.value)} />
        </label>
        <label>Upload WAV, MP3, or other browser-decodable audio
          <input className="block w-full p-2" type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="flex gap-2 flex-wrap">
          <button className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50" disabled={!file || busy || recording} onClick={() => file && void analyze(file, file.name)}>Analyze uploaded audio</button>
          <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={recording ? stopMic : () => void startMic()}>{recording ? 'Stop microphone capture' : 'Record speaker playback'}</button>
          <button className="rounded border px-4 py-2" disabled={!runs.length} onClick={exportJson}>Export results JSON</button>
        </div>
        {busy && <p role="status">Converting audio and requesting Azure assessment…</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Run results ({runs.length})</h2>
        {runs.map(run => <section key={run.id} className="rounded-lg border p-4 space-y-2">
          <p className="font-medium">{run.fileName} · {run.durationMs} ms</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <p>Azure target: <strong>{run.target}</strong></p>
            <p>Actual spoken: <strong>{run.reference}</strong></p>
            <p>Recognized: <strong>{run.transcript ?? 'Unavailable'}</strong></p>
            <p>Exact transcript: <strong>{run.exact === null ? 'Unknown' : run.exact ? 'Yes' : 'No'}</strong></p>
            <p>Word error rate: <strong>{run.wer === null ? 'N/A' : (run.wer * 100).toFixed(1) + '%'}</strong></p>
            <p>Azure status: <strong>{run.result.ok ? 'Success' : 'Failed'}</strong></p>
          </div>
          {run.result.ok && <div className="text-sm">
            <p>Pronunciation: {run.result.data.pronunciationScore} · Accuracy: {run.result.data.accuracyScore} · Fluency: {run.result.data.fluencyScore} · Completeness: {run.result.data.completenessScore}</p>
            <p>Mapped target contains /r/: {wordContainsPhoneme(run.target, '/r/') ? 'Yes' : 'No / unmapped'}</p>
            <details><summary>Raw word and alignment evidence</summary><pre className="overflow-auto text-xs whitespace-pre-wrap">{JSON.stringify({ words: run.result.data.words, alignment: run.result.data.alignmentData, timings: run.result.timingsMs }, null, 2)}</pre></details>
          </div>}
          {!run.result.ok && <p className="text-sm text-destructive">{run.result.error.stage}: {run.result.error.message}</p>}
        </section>)}
      </div>
      <p className="text-xs text-muted-foreground">Warning: Azure reference-guided pronunciation output is not necessarily an independent transcription. Compare the known spoken text and recognized text; this lab does not yet test downstream adaptation or clinical leveling. No results persist after reload unless exported.</p>
    </main>
  );
}
