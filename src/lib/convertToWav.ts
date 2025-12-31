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
    console.log('🎵 [WAV] Initializing Web Worker...');
    worker = new Worker('/wav-converter.worker.js');
    worker.onmessage = (e) => {
      const { id, success, wavBuffer, error, stats } = e.data;
      const pending = pendingRequests.get(id);
      if (!pending) {
        console.warn('🎵 [WAV] Received message for unknown request:', id);
        return;
      }
      
      pendingRequests.delete(id);
      
      if (success) {
        console.log('🎵 [WAV] Worker conversion success:', stats);
        pending.resolve(new Blob([wavBuffer], { type: 'audio/wav' }));
      } else {
        console.error('🎵 [WAV] Worker conversion failed:', error);
        pending.reject(new Error(error || 'WAV conversion failed in worker'));
      }
    };
    worker.onerror = (e) => {
      console.error('🎵 [WAV] Worker crashed:', e.message, e);
      // Reject all pending requests
      pendingRequests.forEach((pending, id) => {
        console.error('🎵 [WAV] Rejecting pending request', id);
        pending.reject(new Error(`WAV worker crashed: ${e.message || 'Unknown error'}`));
      });
      pendingRequests.clear();
      worker = null; // Reset so we can retry
    };
    console.log('🎵 [WAV] Web Worker initialized');
  }
  return worker;
}

/**
 * Convert an audio Blob to WAV format using Web Worker (non-blocking)
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  console.log('🎵 [WAV] convertBlobToWav called', { 
    blobSize: blob.size, 
    blobType: blob.type 
  });
  
  if (blob.size === 0) {
    throw new Error('Cannot convert empty audio blob');
  }
  
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await blob.arrayBuffer();
    console.log('🎵 [WAV] Got ArrayBuffer', { byteLength: arrayBuffer.byteLength });
  } catch (bufferError) {
    console.error('🎵 [WAV] Failed to get ArrayBuffer:', bufferError);
    throw new Error(`Failed to read audio blob: ${bufferError instanceof Error ? bufferError.message : 'Unknown error'}`);
  }
  
  // Try worker first for non-blocking conversion
  try {
    console.log('🎵 [WAV] Attempting worker conversion...');
    return await convertWithWorker(arrayBuffer);
  } catch (workerError) {
    console.warn('🎵 [WAV] Worker conversion failed, falling back to main thread:', workerError);
    try {
      return await convertOnMainThread(arrayBuffer);
    } catch (mainThreadError) {
      console.error('🎵 [WAV] Main thread conversion also failed:', mainThreadError);
      throw new Error(`WAV conversion failed: Worker: ${workerError instanceof Error ? workerError.message : 'Unknown'}, Main: ${mainThreadError instanceof Error ? mainThreadError.message : 'Unknown'}`);
    }
  }
}

/**
 * Convert using Web Worker (non-blocking)
 */
function convertWithWorker(arrayBuffer: ArrayBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    console.log('🎵 [WAV] Worker request', { id, byteLength: arrayBuffer.byteLength });
    pendingRequests.set(id, { resolve, reject });
    
    try {
      const w = getWorker();
      // Clone the buffer since we're transferring ownership
      const bufferCopy = arrayBuffer.slice(0);
      w.postMessage({ arrayBuffer: bufferCopy, id }, [bufferCopy]);
      console.log('🎵 [WAV] Message posted to worker', { id });
    } catch (error) {
      console.error('🎵 [WAV] Failed to post message to worker:', error);
      pendingRequests.delete(id);
      reject(new Error(`Worker postMessage failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return;
    }
    
    // Timeout after 15 seconds (reduced from 30 for faster fallback)
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        console.error('🎵 [WAV] Worker timeout after 15s', { id });
        pendingRequests.delete(id);
        reject(new Error('WAV conversion timeout after 15 seconds'));
      }
    }, 15000);
  });
}

/**
 * Fallback: Convert on main thread (blocking but reliable)
 */
async function convertOnMainThread(arrayBuffer: ArrayBuffer): Promise<Blob> {
  console.log('🎵 [WAV] Main thread conversion starting...', { byteLength: arrayBuffer.byteLength });
  const TARGET_SAMPLE_RATE = 16000;
  
  // Use OfflineAudioContext for better compatibility
  let audioContext: AudioContext | null = null;
  
  try {
    audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    console.log('🎵 [WAV] AudioContext created', { sampleRate: audioContext.sampleRate });
    
    // Clone buffer since decodeAudioData detaches it
    const bufferCopy = arrayBuffer.slice(0);
    
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(bufferCopy);
      console.log('🎵 [WAV] Audio decoded', { 
        duration: audioBuffer.duration, 
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels 
      });
    } catch (decodeError) {
      console.error('🎵 [WAV] decodeAudioData failed:', decodeError);
      throw new Error(`Failed to decode audio: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
    }
    
    const wavBuffer = encodeWav(audioBuffer);
    
    console.log('🎵 [WAV] Main thread conversion success:', {
      wavSize: wavBuffer.byteLength,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration.toFixed(2) + 's',
    });
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
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
