/**
 * Bounded, opt-in verification of deployed speech functions on an isolated
 * backend. Importing this file performs no I/O. --check-env never signs in.
 * This checks response contracts and two synthetic transcript expectations;
 * it does not validate clinical/model accuracy, microphones, or persistence.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveE2EEnvironment } from './e2e-environment.mjs';

const MANIFEST_URL = new URL('../tests/e2e/speech/fixtures/manifest.json', import.meta.url);
const FIXTURE_IDS = ['clear-answer', 'hesitant-answer'];
const SERVICES = ['analyze-speech', 'analyze-pronunciation'];
const PLANNED = FIXTURE_IDS.length * SERVICES.length;

class VerificationError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new VerificationError(message); };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, min = 0, max = Infinity) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const optionalNumber = (value, min = 0, max = Infinity) => value === null || finite(value, min, max);
export const normalizeTranscript = value => String(value).toLowerCase()
  .replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();

export function requireStagingEnvironment(env = process.env) {
  // Force staging after the spread: an inherited public-suite setting must
  // never select its intentionally inert configuration for this live command.
  const settings = resolveE2EEnvironment({ ...env, E2E_SUITE: 'staging' });
  requireValue(settings.suite === 'staging', 'Speech verification requires an isolated staging backend.');
  return settings;
}

function wavDurationMs(bytes) {
  requireValue(Buffer.isBuffer(bytes) && bytes.length >= 44 && bytes.length <= 320_100,
    'Synthetic WAV must be a bounded recording of at most ten seconds.');
  requireValue(bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE',
    'Synthetic fixture must be a RIFF WAV file.');
  let format;
  let dataBytes;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    requireValue(body + size <= bytes.length, 'Synthetic WAV contains a truncated chunk.');
    if (kind === 'fmt ') {
      requireValue(size >= 16, 'Synthetic WAV has no PCM format.');
      format = {
        encoding: bytes.readUInt16LE(body), channels: bytes.readUInt16LE(body + 2),
        rate: bytes.readUInt32LE(body + 4), byteRate: bytes.readUInt32LE(body + 8),
        alignment: bytes.readUInt16LE(body + 12), bits: bytes.readUInt16LE(body + 14),
      };
    }
    if (kind === 'data') dataBytes = size;
    offset = body + size + (size % 2);
  }
  requireValue(format?.encoding === 1 && format.channels === 1 && format.rate === 16000
    && format.byteRate === 32000 && format.alignment === 2 && format.bits === 16,
  'Synthetic fixtures must use mono 16 kHz, 16-bit PCM WAV.');
  requireValue(Number.isInteger(dataBytes) && dataBytes > 0 && dataBytes % 2 === 0,
    'Synthetic WAV must contain complete PCM samples.');
  return dataBytes / format.byteRate * 1000;
}

export function loadSyntheticFixtures({ readFile = readFileSync, manifestURL = MANIFEST_URL } = {}) {
  const manifest = JSON.parse(readFile(manifestURL, 'utf8'));
  requireValue(manifest.schemaVersion === 1 && manifest.synthetic === true
    && manifest.generator === 'ffmpeg/libflite' && Array.isArray(manifest.fixtures),
  'Use the repository synthetic speech manifest; patient recordings are not accepted.');
  return FIXTURE_IDS.map(id => {
    const matches = manifest.fixtures.filter(fixture => fixture.id === id);
    requireValue(matches.length === 1, 'Synthetic speech manifest is missing a unique required fixture.');
    const fixture = matches[0];
    requireValue(fixture.file === `${id}.wav` && basename(fixture.file) === fixture.file,
      'Speech fixture paths must be the fixed repository WAV filenames.');
    requireValue(typeof fixture.target === 'string' && fixture.target.length > 0
      && Array.isArray(fixture.expectedTranscripts) && fixture.expectedTranscripts.length > 0
      && fixture.expectedTranscripts.every(text => typeof text === 'string' && normalizeTranscript(text)),
    'Synthetic fixture must declare its target and accepted transcripts.');
    const audio = readFile(new URL(fixture.file, manifestURL));
    requireValue(createHash('sha256').update(audio).digest('hex') === fixture.sha256,
      'Synthetic WAV hash differs from its provenance manifest. Regenerate/review the fixtures.');
    const durationMs = wavDurationMs(audio);
    requireValue(finite(fixture.durationMs, 1, 10_000) && Math.abs(durationMs - fixture.durationMs) <= 1,
      'Synthetic WAV duration differs from its manifest.');
    return { ...fixture, durationMs, audioBase64: audio.toString('base64') };
  });
}

function validateTranscript(transcript, fixture) {
  requireValue(typeof transcript === 'string' && fixture.expectedTranscripts
    .map(normalizeTranscript).includes(normalizeTranscript(transcript)),
  'Transcript did not match the fixture\'s explicitly accepted words.');
}

export function validateSpeechResponse(body, fixture) {
  requireValue(isRecord(body) && !body.error && body.ok !== false && body.fallback !== true,
    'Speech service returned an error or fallback instead of analysis.');
  validateTranscript(body.transcript, fixture);
  requireValue(optionalNumber(body.confidence, 0, 1), 'Speech confidence must be null or a finite value from 0 to 1.');
  const metrics = body.acousticMetrics;
  requireValue(isRecord(metrics), 'Successful speech response is missing acoustic metric availability.');
  for (const name of ['speechRateWpm', 'totalDurationSec', 'wordCount', 'pauseCount',
    'avgPauseDurationMs', 'totalPauseDurationSec', 'speechToPauseRatio']) {
    requireValue(optionalNumber(metrics[name]), `Acoustic field ${name} must be null or a finite nonnegative value.`);
  }
  for (const name of ['wordCount', 'pauseCount', 'segmentCount']) {
    requireValue((name !== 'segmentCount' && metrics[name] === null)
      || (Number.isInteger(metrics[name]) && metrics[name] >= 0), `Acoustic field ${name} must be an integer count or explicitly unavailable.`);
  }
  requireValue(metrics.totalDurationSec === null || metrics.totalDurationSec <= fixture.durationMs / 1000 + 0.1,
    'Recognized duration exceeds the uploaded synthetic recording.');
  requireValue(metrics.speechRateWpm === null || (metrics.totalDurationSec > 0 && metrics.wordCount !== null),
    'Reported speech rate lacks its duration or word-count evidence.');
  if (metrics.pauseCount === null) {
    requireValue(metrics.avgPauseDurationMs === null && metrics.totalPauseDurationSec === null
      && metrics.speechToPauseRatio === null, 'Unavailable pause timing must not become measured zeros or a ratio.');
  } else {
    requireValue(metrics.segmentCount > 0 && metrics.pauseCount <= Math.max(0, metrics.segmentCount - 1),
      'Pause counts are inconsistent with the returned timing segments.');
    if (metrics.pauseCount === 0) {
      requireValue(metrics.avgPauseDurationMs === 0 && metrics.totalPauseDurationSec === 0
        && metrics.speechToPauseRatio === null, 'No-pause evidence must not contain invented pause duration or a finite ratio.');
    }
    if (metrics.totalPauseDurationSec !== null && metrics.totalDurationSec !== null) {
      requireValue(metrics.totalPauseDurationSec <= metrics.totalDurationSec + 0.002,
        'Pause duration exceeds the recognized interval.');
    }
  }
  // These are consistency checks, not an independent reconstruction of Azure's
  // word boundaries or a clinical validation of the calculated rate.
  return { transcriptMatched: true, timingAvailable: metrics.pauseCount !== null };
}

export function validatePronunciationResponse(body, fixture, requestId) {
  requireValue(isRecord(body) && body.ok === true && !body.error && isRecord(body.data),
    'Pronunciation service returned an error or an invalid success envelope.');
  const data = body.data;
  validateTranscript(data.transcript, fixture);
  for (const name of ['pronunciationScore', 'accuracyScore', 'fluencyScore', 'completenessScore']) {
    requireValue(finite(data[name], 0, 100), `Pronunciation field ${name} must be a finite 0–100 score; zero is valid.`);
  }
  requireValue(optionalNumber(data.prosodyScore, 0, 100), 'Prosody must be null when unavailable, or a finite 0–100 score.');
  requireValue(optionalNumber(data.duration) && (data.duration === null || data.duration <= fixture.durationMs / 1000 + 0.1),
    'Pronunciation duration must be unavailable or fit the uploaded recording.');
  requireValue(Array.isArray(data.words), 'Pronunciation response must include its word-evidence array.');
  for (const word of data.words) {
    requireValue(isRecord(word) && typeof word.word === 'string' && optionalNumber(word.accuracyScore, 0, 100)
      && Array.isArray(word.phonemes), 'Pronunciation word evidence has an invalid shape or score.');
    for (const phone of word.phonemes) {
      requireValue(isRecord(phone) && typeof phone.phoneme === 'string'
        && optionalNumber(phone.accuracyScore, 0, 100) && optionalNumber(phone.duration),
      'Pronunciation phoneme evidence has an invalid shape, score, or duration.');
    }
  }
  if (data.alignmentData != null) {
    for (const name of ['word_segments', 'phone_segments']) {
      requireValue(Array.isArray(data.alignmentData[name]), 'Alignment must include word and phoneme segment arrays.');
      for (const segment of data.alignmentData[name]) {
        requireValue(isRecord(segment) && finite(segment.start) && finite(segment.end)
          && segment.end > segment.start && segment.end <= fixture.durationMs / 1000 + 0.1,
        'Alignment timing is invalid or exceeds the uploaded recording.');
      }
    }
  }
  const returnedId = body.pronRequestId ?? data.pronRequestId;
  requireValue(returnedId === undefined || returnedId === requestId,
    'Pronunciation response correlation ID does not match its request.');
  return { transcriptMatched: true, timingAvailable: data.alignmentData != null,
    requestCorrelation: returnedId === undefined ? 'not_returned' : 'matched' };
}

async function createIsolatedClient(settings) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(settings.supabaseURL, settings.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init = {}) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        requireValue(url.origin === settings.supabaseURL, 'Speech harness refused a request outside the selected isolated backend.');
        return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      },
    },
  });
}

export async function verifySpeechServices({
  env = process.env, mode = 'check-env', loadFixtures = loadSyntheticFixtures,
  clientFactory = createIsolatedClient,
} = {}) {
  const report = {
    mode, status: 'blocked', prerequisites: 'not_checked', authentication: 'not_run', cleanup: 'not_run',
    planned: PLANNED, executed: 0, passed: 0, failed: 0, notRun: PLANNED, checks: [],
    evidence: {
      contractAndSyntheticWords: 'not_run', providerAccuracy: 'not_validated',
      physicalMicrophone: 'not_exercised', databasePersistence: 'not_exercised',
      note: 'No clinical score minimum is imposed. Optional provider timing may remain unavailable. Synthetic auth users are not deleted by sign-out.',
    },
  };
  let phase = 'prerequisites';
  let client;
  let signedIn = false;
  let currentCheck;
  try {
    requireValue(mode === 'check-env' || mode === 'run', 'Select --check-env or explicit --run.');
    const settings = requireStagingEnvironment(env);
    const fixtures = loadFixtures();
    requireValue(fixtures.length === FIXTURE_IDS.length, 'Exactly two approved synthetic fixtures are required.');
    report.prerequisites = 'passed';
    if (mode === 'check-env') { report.status = 'not_run'; return report; }
    phase = 'authentication';
    client = await clientFactory(settings);
    const { data, error } = await client.auth.signInAnonymously();
    signedIn = !!data?.session;
    requireValue(!error && data?.session?.access_token && data?.user?.is_anonymous === true,
      'Synthetic anonymous sign-in failed; enable it only on the isolated test backend.');
    report.authentication = 'passed';
    phase = 'provider_checks';
    for (const fixture of fixtures) {
      for (const service of SERVICES) {
        const requestId = randomUUID();
        currentCheck = { fixture: fixture.id, service, status: 'failed' };
        report.executed += 1;
        const { data, error } = await client.functions.invoke(service, { body: {
          audioBlob: fixture.audioBase64, mimeType: 'audio/wav',
          ...(service === 'analyze-pronunciation' ? { referenceText: fixture.target, pronRequestId: requestId } : {}),
        } });
        requireValue(!error, 'Speech function request failed; inspect the isolated service logs.');
        const details = service === 'analyze-speech'
          ? validateSpeechResponse(data, fixture) : validatePronunciationResponse(data, fixture, requestId);
        report.checks.push({ ...currentCheck, ...details, status: 'passed' });
        report.passed += 1;
        currentCheck = undefined;
      }
    }
    report.status = 'passed';
    report.evidence.contractAndSyntheticWords = 'passed';
  } catch (error) {
    report.status = phase === 'prerequisites' ? 'blocked' : 'failed';
    if (phase === 'prerequisites') report.prerequisites = 'failed';
    if (phase === 'authentication') report.authentication = 'failed';
    if (phase === 'provider_checks') report.evidence.contractAndSyntheticWords = 'failed';
    report.failure = { phase, reason: error instanceof VerificationError || phase === 'prerequisites'
      ? error.message : 'Request failed; inspect the isolated service logs.' };
    if (currentCheck) { report.failed += 1; report.checks.push(currentCheck); }
  } finally {
    report.notRun = PLANNED - report.executed;
    if (client && signedIn) {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw new Error('Sign-out failed');
        report.cleanup = 'signed_out';
      } catch {
        report.cleanup = 'failed'; report.status = 'failed';
        report.cleanupReason = 'Synthetic session sign-out failed; inspect the isolated backend.';
      }
    }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.length === 3 && process.argv[2] === '--run' ? 'run'
    : process.argv.length === 3 && process.argv[2] === '--check-env' ? 'check-env' : 'invalid';
  const report = await verifySpeechServices({ mode });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'passed' || (mode === 'check-env' && report.prerequisites === 'passed') ? 0 : 1;
}
