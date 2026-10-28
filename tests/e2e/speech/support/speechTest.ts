import type { Route } from '@playwright/test';
import { test as base, expect } from '../../fixtures/safeTest';
import { isBlockedBackendRequest, resolveE2EEnvironment } from '../../../../scripts/e2e-environment.mjs';
import { installBrowserControls } from './browserControls';

export type JsonObject = Record<string, unknown>;
export interface AnalysisRequest { route: Route; body: JsonObject; }
export interface MockTransport {
  speechRequests: JsonObject[];
  pronunciationRequests: JsonObject[];
  uploads: Array<{ path: string; bytes: number; contentType: string }>;
  utterances: JsonObject[];
  speechResponse: JsonObject;
  pronunciationResponse: JsonObject;
  holdSpeech: boolean;
  holdPronunciation: boolean;
  pendingSpeech: AnalysisRequest[];
  pendingPronunciation: AnalysisRequest[];
  uploadStatus: number;
}

export const knownSpeech = {
  transcript: 'apple', confidence: 0.94, source: 'azure',
  acousticMetrics: {
    speechRateWpm: 75, pauseCount: 0, totalPauseDurationSec: 0,
    avgPauseDurationMs: 0, wordCount: 1, totalDurationSec: 0.8, segmentCount: 1,
  },
};
export const knownPronunciation = {
  ok: true,
  data: {
    pronunciationScore: 84, accuracyScore: 87, fluencyScore: 0,
    completenessScore: 100, prosodyScore: null, transcript: 'apple',
    words: [{ word: 'apple', accuracyScore: 87, errorType: 'None', phonemes: [] }],
    alignmentData: { word_segments: [{ word: 'apple', start: 0.2, end: 1 }], phone_segments: [] },
  },
};

export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export const test = base.extend<{ transport: MockTransport; browserControls: void }>({
  transport: [async ({ context, baseURL }, use) => {
    const settings = resolveE2EEnvironment();
    if (settings.suite !== 'public') throw new Error('Speech tests never use a real backend.');
    const unexpected: string[] = [];
    const transport: MockTransport = {
      speechRequests: [], pronunciationRequests: [], uploads: [], utterances: [],
      speechResponse: structuredClone(knownSpeech), pronunciationResponse: structuredClone(knownPronunciation),
      holdSpeech: false, holdPronunciation: false, pendingSpeech: [], pendingPronunciation: [],
      uploadStatus: 200,
    };
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (isBlockedBackendRequest(url.href, settings)) {
        unexpected.push(`Forbidden backend ${url.origin}`);
        return route.abort('blockedbyclient');
      }
      if (url.origin === baseURL) return route.fallback();
      if (url.origin !== settings.supabaseURL) {
        unexpected.push(`External request ${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      if (url.pathname === '/functions/v1/analyze-speech') {
        const body = request.postDataJSON() as JsonObject;
        transport.speechRequests.push(body);
        if (transport.holdSpeech) { transport.pendingSpeech.push({ route, body }); return; }
        return fulfillJson(route, transport.speechResponse);
      }
      if (url.pathname === '/functions/v1/analyze-pronunciation') {
        const body = request.postDataJSON() as JsonObject;
        transport.pronunciationRequests.push(body);
        if (transport.holdPronunciation) { transport.pendingPronunciation.push({ route, body }); return; }
        return fulfillJson(route, transport.pronunciationResponse);
      }
      if (url.pathname.startsWith('/storage/v1/object/session-recordings/') && request.method() === 'POST') {
        const path = url.pathname.slice('/storage/v1/object/session-recordings/'.length);
        transport.uploads.push({ path, bytes: request.postDataBuffer()?.length ?? 0, contentType: request.headers()['content-type'] ?? '' });
        return fulfillJson(route, transport.uploadStatus === 200
          ? { Key: `session-recordings/${path}`, Id: 'synthetic-upload' }
          : { message: 'Synthetic storage failure' }, transport.uploadStatus);
      }
      const table = url.pathname.replace('/rest/v1/', '');
      if (url.pathname.startsWith('/rest/v1/')) {
        if (request.method() === 'GET') {
          if (table === 'user_roles') return fulfillJson(route, []);
          if (['user_speech_profiles', 'user_capabilities', 'clinical_progression_state', 'profiles', 'sessions'].includes(table)) {
            return fulfillJson(route, request.headers().accept?.includes('object') ? null : []);
          }
        }
        if (['POST', 'PATCH'].includes(request.method())) {
          if (table === 'utterance_analyses') {
            const payload = request.postDataJSON() as JsonObject | JsonObject[];
            transport.utterances.push(...(Array.isArray(payload) ? payload : [payload]));
            return fulfillJson(route, null);
          }
          if (['adaptation_trial_logs', 'adaptation_events', 'engagement_interventions', 'sessions', 'dose_logs'].includes(table)) {
            return fulfillJson(route, null);
          }
        }
      }
      // A new app dependency must be reviewed rather than silently returning a
      // generic success that could hide a missing real integration.
      unexpected.push(`${request.method()} ${url.pathname}`);
      await fulfillJson(route, { message: 'Unconfigured local speech test transport' }, 503);
    });
    await context.routeWebSocket('**/*', (socket) => {
      unexpected.push(`Unexpected WebSocket ${new URL(socket.url()).origin}`);
      socket.close();
    });
    await use(transport);
    expect(unexpected, 'All external requests must be blocked; all local backend contracts must be explicit').toEqual([]);
  }, { auto: true }],
  browserControls: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await installBrowserControls(page);
    await use();
    expect(errors, 'The real speech components must not throw browser runtime errors').toEqual([]);
  }, { auto: true }],
});

export { expect };
