import { useState, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { convertBlobToWavWithDiagnostics } from '@/lib/convertToWav';
import { PhotoNamingGame } from '@/components/PhotoNamingGame';
import { ProfileContext, type ProfileContextValue } from '@/contexts/profile-context-value';
import { CoachingModeProvider } from '@/contexts/CoachingModeContext';
import { LiveAnalysisProvider, useLiveAnalysis } from '@/contexts/LiveAnalysisContext';
import { voiceController } from '@/lib/voiceController';
import '@/index.css';

const sessionId = '22222222-2222-4222-8222-222222222222';
const noop = async () => {};
const profile: ProfileContextValue = {
  activeProfile: null, allProfiles: [], loading: false,
  switchProfile: noop, refreshProfiles: noop, createProfile: async () => undefined,
};

/** Inspect the actual converted output; this does not simulate conversion. */
function inspectWav(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const text = (offset: number, size: number) => String.fromCharCode(...new Uint8Array(buffer, offset, size));
  const sampleRate = view.getUint32(24, true);
  const samples = new Int16Array(buffer, 44);
  const windowSize = Math.round(sampleRate * 0.05);
  const windows: number[] = [];
  let peak = 0;
  for (let i = 0; i < samples.length; i += windowSize) {
    let squares = 0;
    const end = Math.min(i + windowSize, samples.length);
    for (let j = i; j < end; j++) {
      const value = samples[j] / 32768;
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
    }
    windows.push(Math.sqrt(squares / (end - i)));
  }
  const voiced = windows.map((rms) => rms >= 0.008);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  let longestInternalSilence = 0;
  let currentSilence = 0;
  for (let i = first; i >= 0 && i <= last; i++) {
    currentSilence = voiced[i] ? 0 : currentSilence + 0.05;
    longestInternalSilence = Math.max(longestInternalSilence, currentSilence);
  }
  return {
    riff: text(0, 4), wave: text(8, 4), format: view.getUint16(20, true),
    channels: view.getUint16(22, true), sampleRate, bitsPerSample: view.getUint16(34, true),
    dataBytes: view.getUint32(40, true), decodedDuration: samples.length / sampleRate,
    peak, voicedWindows: voiced.filter(Boolean).length, longestInternalSilence,
  };
}

export function RecorderHarness() {
  const recorder = useAudioRecorder();
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = async () => {
    try {
      const recording = await recorder.stopRecording();
      if (!recording) throw new Error('No recording returned by useAudioRecorder');
      const conversion = await convertBlobToWavWithDiagnostics(recording.audioBlob);
      if (conversion.ok === false) {
        setReport({ durationMs: recording.duration, recordedBytes: recording.audioBlob.size, conversionError: conversion.error });
        return;
      }
      setReport({
        mimeType: recording.mimeType, recordedBytes: recording.audioBlob.size,
        durationMs: recording.duration, conversion: conversion.stats,
        wav: inspectWav(await conversion.wavBlob.arrayBuffer()),
      });
    } catch (cause) { setError(String(cause)); }
  };
  return <main>
    <h1>Real audio recorder hook</h1>
    <p>Native getUserMedia, MediaRecorder and WAV conversion. No speech recognizer runs here.</p>
    <button onClick={() => { setReport(null); setError(null); void recorder.startRecording(); }}>Start recording</button>
    <button onClick={() => void stop()} disabled={!recorder.isRecording}>Stop and convert</button>
    <button onClick={recorder.cancelRecording} disabled={!recorder.isRecording}>Cancel recording</button>
    <output data-testid="recording-state">{recorder.isRecording ? 'recording' : 'idle'}</output>
    <pre data-testid="capture-report">{JSON.stringify(report)}</pre>
    <pre data-testid="capture-error">{error}</pre>
  </main>;
}

// Different difficulty lanes make the real hook select apple, cup, then book.
// Images are local SVG data, so the harness never fetches a content CDN.
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#e2e8f0"/><circle cx="100" cy="100" r="50" fill="#468c52"/></svg>')}`;
const trials = [
  { id: 'synthetic-apple', target: 'apple', category: 'food', computed_difficulty: 1, semanticFoils: ['pear'], unrelatedFoils: ['shoe'], imageUrl: image },
  { id: 'synthetic-cup', target: 'cup', category: 'household', computed_difficulty: 3, semanticFoils: ['bowl'], unrelatedFoils: ['tree'], imageUrl: image },
  { id: 'synthetic-book', target: 'book', category: 'household', computed_difficulty: 5, semanticFoils: ['paper'], unrelatedFoils: ['pear'], imageUrl: image },
];
type TrialResult = Parameters<NonNullable<ComponentProps<typeof PhotoNamingGame>['onTrialComplete']>>[0];

export function GameHarness() {
  const [results, setResults] = useState<Array<{ result: TrialResult; target: string }>>([]);
  const { snapshot } = useLiveAnalysis();
  return <main>
    <h1>Photo Naming speech integration</h1>
    <button onClick={() => voiceController.notifySpeakingChanged(true)}>Hold coach microphone lock</button>
    <button onClick={() => voiceController.notifySpeakingChanged(false)}>Release coach microphone lock</button>
    <PhotoNamingGame totalTrials={3} initialDifficulty={1} sessionId={sessionId} customTrials={trials}
      onTrialComplete={(result, trial) => setResults((previous) => [...previous, { result, target: trial.target }])} />
    <pre data-testid="trial-results">{JSON.stringify(results)}</pre>
    <pre data-testid="live-snapshot">{JSON.stringify(snapshot)}</pre>
  </main>;
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <MemoryRouter><QueryClientProvider client={client}><ProfileContext.Provider value={profile}>
    <CoachingModeProvider><LiveAnalysisProvider>
      {new URLSearchParams(location.search).get('view') === 'game' ? <GameHarness /> : <RecorderHarness />}
    </LiveAnalysisProvider></CoachingModeProvider>
  </ProfileContext.Provider></QueryClientProvider></MemoryRouter>,
);
