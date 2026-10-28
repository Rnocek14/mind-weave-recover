import { describe, expect, it } from 'vitest';
import { azureAudioContentType, buildAzureSpeechRequest, decodeAudioBase64 } from '../../../supabase/functions/_shared/azureSpeechRequest';

/** A synthetic 0.1-second silence file with a real PCM WAV container. */
function pcmWav() {
  const bytes = new Uint8Array(44 + 3200);
  const view = new DataView(bytes.buffer);
  const label = (at: number, value: string) => [...value].forEach((letter, i) => { bytes[at + i] = letter.charCodeAt(0); });
  label(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); label(8, 'WAVE');
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  label(36, 'data'); view.setUint32(40, 3200, true);
  return bytes;
}

describe('Production Azure request construction', () => {
  it('builds the documented detailed STT request using the validated PCM bytes', () => {
    const audio = pcmWav();
    const request = buildAzureSpeechRequest({ region: 'test-region', key: 'synthetic-key', audio, mimeType: 'audio/wav' });
    const url = new URL(request.url);
    expect(url.searchParams.get('language')).toBe('en-US');
    expect(url.searchParams.get('format')).toBe('detailed');
    expect(request.init.method).toBe('POST');
    const headers = new Headers(request.init.headers);
    expect(headers.get('Content-Type')).toBe('audio/wav; codecs=audio/pcm; samplerate=16000');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Ocp-Apim-Subscription-Key')).toBe('synthetic-key');
    expect(headers.has('Pronunciation-Assessment')).toBe(false);
    expect(new Uint8Array(request.init.body as ArrayBuffer)).toEqual(audio);
  });

  it('uses the same real audio request plus canonical pronunciation options and UTF-8 reference text', () => {
    const request = buildAzureSpeechRequest({ region: 'test-region', key: 'synthetic-key', audio: pcmWav(), mimeType: 'audio/wav', referenceText: 'café' });
    const header = new Headers(request.init.headers).get('Pronunciation-Assessment')!;
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(header), (c) => c.charCodeAt(0)));
    expect(JSON.parse(decoded)).toEqual({
      ReferenceText: 'café', GradingSystem: 'HundredMark', Granularity: 'Phoneme',
      Dimension: 'Comprehensive', EnableMiscue: true, EnableProsodyAssessment: true, NBestPhonemeCount: 5,
    });
  });

  it.each(['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', '', undefined])('rejects unsupported recorder MIME %s before an Azure request can be sent', (mimeType) => {
    expect(() => buildAzureSpeechRequest({ region: 'test-region', key: 'synthetic-key', audio: pcmWav(), mimeType })).toThrow(/Convert this recording/);
  });

  it('rejects a WebM signature relabeled as WAV and a truncated WAV', () => {
    const webm = new Uint8Array(1000); webm.set([0x1a, 0x45, 0xdf, 0xa3]);
    expect(() => azureAudioContentType(webm, 'audio/wav')).toThrow(/RIFF\/WAVE/);
    expect(() => azureAudioContentType(pcmWav().subarray(0, 100), 'audio/wav')).toThrow(/truncated/);
  });

  it.each([
    [22, 2, 2], // stereo
    [24, 48000, 4], // unsupported WAV sample rate
    [34, 8, 2], // 8-bit samples
    [20, 3, 2], // floating-point format
  ])('rejects a mismatched WAV format at offset %i', (offset, value, width) => {
    const audio = pcmWav();
    const view = new DataView(audio.buffer);
    if (width === 4) view.setUint32(offset, value, true);
    else view.setUint16(offset, value, true);
    expect(() => azureAudioContentType(audio, 'audio/wav')).toThrow(/16 kHz, mono, 16-bit PCM/);
  });

  it('recognizes an Ogg Opus header and rejects another container labeled Ogg', () => {
    const bytes = new Uint8Array(80);
    for (const [offset, text] of [[0, 'OggS'], [28, 'OpusHead']] as const) {
      [...text].forEach((letter, i) => { bytes[offset + i] = letter.charCodeAt(0); });
    }
    bytes[26] = 1; bytes[27] = 19; bytes[37] = 1;
    expect(azureAudioContentType(bytes, 'audio/ogg; codecs=opus')).toBe('audio/ogg; codecs=opus');
    expect(() => azureAudioContentType(pcmWav(), 'audio/ogg')).toThrow(/Ogg\/Opus/);
  });

  it('decodes the actual WAV bytes and rejects malformed base64', () => {
    const audio = pcmWav();
    expect(decodeAudioBase64(btoa(String.fromCharCode(...audio)))).toEqual(audio);
    expect(() => decodeAudioBase64('%%%invalid%%%')).toThrow(/base64/);
  });
});
