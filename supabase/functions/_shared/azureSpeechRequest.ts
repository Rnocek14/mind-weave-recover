/** Pure request construction shared by Azure short-audio calls and their tests.
 * https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short
 */
export class AzureAudioValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'AzureAudioValidationError'; }
}

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

export function decodeAudioBase64(value: string): Uint8Array {
  try { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
  catch { throw new AzureAudioValidationError('Audio data is not valid base64.'); }
}

function validatePcmWav(bytes: Uint8Array): void {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    throw new AzureAudioValidationError('WAV audio must contain a RIFF/WAVE header.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd > bytes.length || riffEnd < 44) {
    throw new AzureAudioValidationError('WAV audio is truncated or has an invalid RIFF length.');
  }
  let hasFormat = false;
  let hasAudio = false;
  for (let offset = 12; offset + 8 <= riffEnd;) {
    const chunk = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > riffEnd) throw new AzureAudioValidationError('WAV audio contains a truncated chunk.');
    if (chunk === 'fmt ') {
      if (size < 16 || view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1
        || view.getUint32(start + 4, true) !== 16000 || view.getUint16(start + 14, true) !== 16
        || view.getUint16(start + 12, true) !== 2 || view.getUint32(start + 8, true) !== 32000) {
        throw new AzureAudioValidationError('Azure short-audio WAV must be 16 kHz, mono, 16-bit PCM.');
      }
      hasFormat = true;
    }
    if (chunk === 'data') {
      if (size === 0 || size % 2 !== 0) throw new AzureAudioValidationError('WAV audio has no complete PCM samples.');
      hasAudio = true;
    }
    offset = start + size + (size % 2);
  }
  if (!hasFormat || !hasAudio) throw new AzureAudioValidationError('WAV audio requires format and PCM data chunks.');
}

function validateOggOpus(bytes: Uint8Array): void {
  if (bytes.length < 47 || ascii(bytes, 0, 4) !== 'OggS' || bytes[4] !== 0) {
    throw new AzureAudioValidationError('Ogg audio must contain an Ogg/Opus identification header.');
  }
  const bodyStart = 27 + bytes[26];
  if (bodyStart + 19 > bytes.length || ascii(bytes, bodyStart, 8) !== 'OpusHead' || bytes[bodyStart + 9] !== 1) {
    throw new AzureAudioValidationError('Azure short-audio Ogg must identify a mono Opus stream.');
  }
}

export function azureAudioContentType(audio: Uint8Array, mimeType: unknown): string {
  const mime = typeof mimeType === 'string' ? mimeType.toLowerCase().split(';')[0].trim() : '';
  if (mime === 'audio/wav' || mime === 'audio/wave' || mime === 'audio/x-wav') {
    validatePcmWav(audio);
    return 'audio/wav; codecs=audio/pcm; samplerate=16000';
  }
  if (mime === 'audio/ogg') {
    validateOggOpus(audio);
    return 'audio/ogg; codecs=opus';
  }
  throw new AzureAudioValidationError('Convert this recording to 16 kHz mono PCM WAV before speech analysis; only PCM WAV or Ogg Opus is supported.');
}

export function buildAzureSpeechRequest(options: {
  region: string;
  key: string;
  audio: Uint8Array;
  mimeType: unknown;
  referenceText?: string;
}): { url: string; init: RequestInit } {
  const contentType = azureAudioContentType(options.audio, options.mimeType);
  const headers: Record<string, string> = {
    'Ocp-Apim-Subscription-Key': options.key,
    'Content-Type': contentType,
    Accept: 'application/json',
  };
  if (options.referenceText !== undefined) {
    if (!options.referenceText.trim()) throw new AzureAudioValidationError('Reference text must not be empty.');
    const config = JSON.stringify({
      ReferenceText: options.referenceText,
      GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive',
      EnableMiscue: true, EnableProsodyAssessment: true, NBestPhonemeCount: 5,
    });
    // btoa accepts bytes, not Unicode text. UTF-8 keeps non-ASCII reference words intact.
    headers['Pronunciation-Assessment'] = btoa(String.fromCharCode(...new TextEncoder().encode(config)));
  }
  return {
    url: `https://${options.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,
    init: { method: 'POST', headers, body: new Uint8Array(options.audio).buffer },
  };
}
