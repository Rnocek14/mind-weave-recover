/**
 * Converts any audio Blob (WebM/Opus, etc.) to WAV format
 * suitable for Azure Pronunciation Assessment API.
 * 
 * Azure requires: 16kHz mono PCM WAV for best phoneme-level analysis.
 * 
 * Uses Web Worker for non-blocking conversion on large audio files.
 */

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>();

/**
 * Initialize the Web Worker (lazy load)
 */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/wav-converter.worker.js');
    worker.onmessage = (e) => {
      const { id, success, wavBuffer, error, stats } = e.data;
      const pending = pendingRequests.get(id);
      if (!pending) return;
      
      pendingRequests.delete(id);
      
      if (success) {
        console.log('🎵 Audio converted to WAV (worker):', stats);
        pending.resolve(new Blob([wavBuffer], { type: 'audio/wav' }));
      } else {
        pending.reject(new Error(error || 'WAV conversion failed'));
      }
    };
    worker.onerror = (e) => {
      console.error('WAV worker error:', e);
      // Reject all pending requests
      pendingRequests.forEach((pending) => {
        pending.reject(new Error('WAV worker crashed'));
      });
      pendingRequests.clear();
      worker = null; // Reset so we can retry
    };
  }
  return worker;
}

/**
 * Convert an audio Blob to WAV format using Web Worker (non-blocking)
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  
  // Try worker first for non-blocking conversion
  try {
    return await convertWithWorker(arrayBuffer);
  } catch (workerError) {
    console.warn('Worker conversion failed, falling back to main thread:', workerError);
    return await convertOnMainThread(arrayBuffer);
  }
}

/**
 * Convert using Web Worker (non-blocking)
 */
function convertWithWorker(arrayBuffer: ArrayBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pendingRequests.set(id, { resolve, reject });
    
    try {
      const w = getWorker();
      w.postMessage({ arrayBuffer, id }, [arrayBuffer]); // Transfer ownership for speed
    } catch (error) {
      pendingRequests.delete(id);
      reject(error);
    }
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('WAV conversion timeout'));
      }
    }, 30000);
  });
}

/**
 * Fallback: Convert on main thread (blocking but reliable)
 */
async function convertOnMainThread(arrayBuffer: ArrayBuffer): Promise<Blob> {
  const TARGET_SAMPLE_RATE = 16000;
  const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBuffer = encodeWav(audioBuffer);
    
    console.log('🎵 Audio converted to WAV (main thread):', {
      wavSize: wavBuffer.byteLength,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration.toFixed(2) + 's',
    });
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    await audioContext.close();
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
