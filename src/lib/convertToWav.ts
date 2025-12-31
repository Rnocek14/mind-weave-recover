/**
 * Converts any audio Blob (WebM/Opus, etc.) to WAV format
 * suitable for Azure Pronunciation Assessment API.
 * 
 * Azure requires: 16kHz mono PCM WAV for best phoneme-level analysis.
 * 
 * Uses Web Worker for non-blocking conversion on large audio files.
 * Returns structured errors matching DB diagnostics schema.
 */

export interface WavConversionResult {
  ok: true;
  wavBlob: Blob;
  stats: {
    inputSize: number;
    outputSize: number;
    duration: string;
    originalSampleRate: number;
    targetSampleRate: number;
  };
  timingsMs: { decode: number; resample: number; encode: number; total: number };
}

export interface WavConversionError {
  ok: false;
  error: {
    stage: 'validation' | 'decode' | 'resample' | 'encode' | 'unexpected' | 'timeout';
    message: string;
    details?: Record<string, unknown>;
  };
  timingsMs?: { decode?: number; resample?: number; encode?: number; total: number };
}

export type WavConversionOutcome = WavConversionResult | WavConversionError;

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { 
  resolve: (result: WavConversionOutcome) => void; 
  timeoutId: NodeJS.Timeout;
}>();

/**
 * Initialize the Web Worker (lazy load)
 */
function getWorker(): Worker {
  if (!worker) {
    console.log('🎵 [WAV] Initializing Web Worker...');
    worker = new Worker('/wav-converter.worker.js');
    worker.onmessage = (e) => {
      const { id, success, wavBuffer, error, stats, timingsMs } = e.data;
      const pending = pendingRequests.get(id);
      if (!pending) {
        console.warn('🎵 [WAV] Received message for unknown request:', id);
        return;
      }
      
      clearTimeout(pending.timeoutId);
      pendingRequests.delete(id);
      
      if (success) {
        console.log('🎵 [WAV] Worker conversion success:', { stats, timingsMs });
        pending.resolve({
          ok: true,
          wavBlob: new Blob([wavBuffer], { type: 'audio/wav' }),
          stats,
          timingsMs
        });
      } else {
        console.error('🎵 [WAV] Worker conversion failed:', error);
        pending.resolve({
          ok: false,
          error: typeof error === 'object' ? error : { stage: 'unexpected', message: error || 'Unknown error' },
          timingsMs
        });
      }
    };
    worker.onerror = (e) => {
      console.error('🎵 [WAV] Worker crashed:', e.message, e);
      // Reject all pending requests
      pendingRequests.forEach((pending, id) => {
        clearTimeout(pending.timeoutId);
        console.error('🎵 [WAV] Rejecting pending request', id);
        pending.resolve({
          ok: false,
          error: { stage: 'unexpected', message: `Worker crashed: ${e.message || 'Unknown error'}` }
        });
      });
      pendingRequests.clear();
      worker = null; // Reset so we can retry
    };
    console.log('🎵 [WAV] Web Worker initialized');
  }
  return worker;
}

/**
 * Convert an audio Blob to WAV format
 * Returns structured result for diagnostics
 */
export async function convertBlobToWavWithDiagnostics(blob: Blob): Promise<WavConversionOutcome> {
  console.log('🎵 [WAV] convertBlobToWav called', { 
    blobSize: blob.size, 
    blobType: blob.type 
  });
  
  if (blob.size === 0) {
    return {
      ok: false,
      error: { stage: 'validation', message: 'Cannot convert empty audio blob' }
    };
  }
  
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await blob.arrayBuffer();
    console.log('🎵 [WAV] Got ArrayBuffer', { byteLength: arrayBuffer.byteLength });
  } catch (bufferError) {
    console.error('🎵 [WAV] Failed to get ArrayBuffer:', bufferError);
    return {
      ok: false,
      error: { 
        stage: 'validation', 
        message: `Failed to read audio blob: ${bufferError instanceof Error ? bufferError.message : 'Unknown error'}` 
      }
    };
  }
  
  // Try worker first for non-blocking conversion
  const workerResult = await convertWithWorker(arrayBuffer);
  if (workerResult.ok) {
    return workerResult;
  }
  
  // TypeScript narrowing: workerResult is WavConversionError here
  const workerError = workerResult as WavConversionError;
  console.warn('🎵 [WAV] Worker conversion failed, falling back to main thread:', workerError.error);
  return await convertOnMainThread(arrayBuffer);
}

/**
 * Legacy function for backward compatibility - throws on error
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const result = await convertBlobToWavWithDiagnostics(blob);
  if (!result.ok) {
    // TypeScript narrowing: result is WavConversionError here
    const errorResult = result as WavConversionError;
    throw new Error(`${errorResult.error.stage}: ${errorResult.error.message}`);
  }
  return result.wavBlob;
}

/**
 * Convert using Web Worker (non-blocking)
 */
function convertWithWorker(arrayBuffer: ArrayBuffer): Promise<WavConversionOutcome> {
  return new Promise((resolve) => {
    const id = ++requestId;
    console.log('🎵 [WAV] Worker request', { id, byteLength: arrayBuffer.byteLength });
    
    // Timeout after 15 seconds (reduced from 30 for faster fallback)
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        console.error('🎵 [WAV] Worker timeout after 15s', { id });
        pendingRequests.delete(id);
        const errorResult: WavConversionError = {
          ok: false,
          error: { stage: 'timeout', message: 'WAV conversion timeout after 15 seconds' },
          timingsMs: { total: 15000 }
        };
        resolve(errorResult);
      }
    }, 15000);
    
    pendingRequests.set(id, { resolve, timeoutId });
    
    try {
      const w = getWorker();
      // Transfer ownership - worker gets the buffer, we don't need it anymore
      // This avoids copying and reduces memory usage
      w.postMessage({ arrayBuffer, id }, [arrayBuffer]);
      console.log('🎵 [WAV] Message posted to worker (transferred)', { id });
    } catch (error) {
      console.error('🎵 [WAV] Failed to post message to worker:', error);
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      const errorResult: WavConversionError = {
        ok: false,
        error: { stage: 'unexpected', message: `Worker postMessage failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
      };
      resolve(errorResult);
    }
  });
}

/**
 * Fallback: Convert on main thread (blocking but reliable)
 */
async function convertOnMainThread(arrayBuffer: ArrayBuffer): Promise<WavConversionOutcome> {
  console.log('🎵 [WAV] Main thread conversion starting...', { byteLength: arrayBuffer.byteLength });
  const TARGET_SAMPLE_RATE = 16000;
  const startTime = performance.now();
  const timings = { decode: 0, resample: 0, encode: 0, total: 0 };
  
  // Use OfflineAudioContext for better compatibility
  let audioContext: AudioContext | null = null;
  
  try {
    audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    console.log('🎵 [WAV] AudioContext created', { sampleRate: audioContext.sampleRate });
    
    // Clone buffer since decodeAudioData detaches it
    const bufferCopy = arrayBuffer.slice(0);
    
    const decodeStart = performance.now();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(bufferCopy);
      timings.decode = Math.round(performance.now() - decodeStart);
      console.log('🎵 [WAV] Audio decoded', { 
        duration: audioBuffer.duration, 
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        decodeMs: timings.decode
      });
    } catch (decodeError) {
      timings.decode = Math.round(performance.now() - decodeStart);
      timings.total = Math.round(performance.now() - startTime);
      console.error('🎵 [WAV] decodeAudioData failed:', decodeError);
      return {
        ok: false,
        error: { stage: 'decode', message: `Failed to decode audio: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}` },
        timingsMs: timings
      };
    }
    
    const encodeStart = performance.now();
    const wavBuffer = encodeWav(audioBuffer);
    timings.encode = Math.round(performance.now() - encodeStart);
    timings.total = Math.round(performance.now() - startTime);
    
    console.log('🎵 [WAV] Main thread conversion success:', {
      wavSize: wavBuffer.byteLength,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration.toFixed(2) + 's',
      timingsMs: timings
    });
    
    return {
      ok: true,
      wavBlob: new Blob([wavBuffer], { type: 'audio/wav' }),
      stats: {
        inputSize: arrayBuffer.byteLength,
        outputSize: wavBuffer.byteLength,
        duration: audioBuffer.duration.toFixed(2),
        originalSampleRate: audioBuffer.sampleRate,
        targetSampleRate: TARGET_SAMPLE_RATE
      },
      timingsMs: timings
    };
  } catch (error) {
    timings.total = Math.round(performance.now() - startTime);
    return {
      ok: false,
      error: { stage: 'unexpected', message: error instanceof Error ? error.message : 'Unknown error' },
      timingsMs: timings
    };
  } finally {
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (closeError) {
        console.warn('🎵 [WAV] AudioContext close error:', closeError);
      }
    }
  }
}

/**
 * Encode AudioBuffer as WAV (16-bit PCM)
 */
function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  
  let samples: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      samples[i] = (left[i] + right[i]) / 2;
    }
  }
  
  const numSamples = samples.length;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}