/**
 * Web Worker for WebM/Opus → WAV conversion
 * Runs off main thread to prevent UI blocking during audio processing.
 * 
 * Azure Pronunciation Assessment requires 16kHz mono PCM WAV.
 * 
 * Returns structured stats/errors matching DB diagnostics schema.
 * Uses workerStage for internal detail, pipeline uses 'wav_conversion' as stage.
 */

const TARGET_SAMPLE_RATE = 16000;

self.onmessage = async (e) => {
  const { arrayBuffer, id } = e.data;
  const startTime = performance.now();
  
  console.log('[WAV Worker] Received request', { id, byteLength: arrayBuffer?.byteLength });
  
  // Structured error helper - uses workerStage for internal detail
  const fail = (workerStage, message, details = {}) => {
    const elapsed = Math.round(performance.now() - startTime);
    console.error('[WAV Worker] Failed:', { id, workerStage, message, elapsed });
    self.postMessage({
      id,
      ok: false,
      error: { workerStage, message, details },
      timingsMs: { decode: details.decodeMs || 0, resample: details.resampleMs || 0, encode: details.encodeMs || 0, total: elapsed },
    });
  };
  
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    fail('validation', 'Empty or missing audio data');
    return;
  }
  
  // Track timings for diagnostics
  const timings = { decode: 0, resample: 0, encode: 0, total: 0 };
  
  try {
    // =========================================================================
    // Step 1: DECODE - Use OfflineAudioContext with reasonable sizing
    // =========================================================================
    console.log('[WAV Worker] Step 1: Decoding...');
    const decodeStart = performance.now();
    
    // Check for OfflineAudioContext support
    if (typeof OfflineAudioContext === 'undefined') {
      fail('decode', 'OfflineAudioContext not available in this worker context');
      return;
    }
    
    let audioBuffer;
    try {
      // Use a reasonably sized context (~2 seconds at 48kHz) to avoid:
      // 1. The "1 frame" bug on Safari/iOS
      // 2. Huge memory allocations (30s was overkill)
      // The context length doesn't limit decode - just needs to be >1 frame
      const DECODE_CONTEXT_FRAMES = 96000; // ~2 seconds at 48kHz
      const DECODE_SAMPLE_RATE = 48000;
      const decodeCtx = new OfflineAudioContext(
        2, // stereo to handle any input
        DECODE_CONTEXT_FRAMES,
        DECODE_SAMPLE_RATE
      );
      
      audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
      timings.decode = Math.round(performance.now() - decodeStart);
      
      console.log('[WAV Worker] Decoded:', { 
        duration: audioBuffer.duration.toFixed(2), 
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        decodeMs: timings.decode
      });
    } catch (decodeError) {
      timings.decode = Math.round(performance.now() - decodeStart);
      fail('decode', `decodeAudioData failed: ${decodeError.message || 'Unknown format'}`, { 
        decodeMs: timings.decode,
        errorType: decodeError.name 
      });
      return;
    }
    
    // =========================================================================
    // Step 2: RESAMPLE to 16kHz mono
    // =========================================================================
    console.log('[WAV Worker] Step 2: Resampling to', TARGET_SAMPLE_RATE);
    const resampleStart = performance.now();
    
    let samples;
    try {
      // Always use OfflineAudioContext for resampling - sized correctly to output
      const outputLength = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
      const resampleCtx = new OfflineAudioContext(1, outputLength, TARGET_SAMPLE_RATE);
      
      const source = resampleCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(resampleCtx.destination);
      source.start(0);
      
      const resampledBuffer = await resampleCtx.startRendering();
      samples = resampledBuffer.getChannelData(0);
      timings.resample = Math.round(performance.now() - resampleStart);
      
      console.log('[WAV Worker] Resampled:', { 
        samples: samples.length,
        resampleMs: timings.resample
      });
    } catch (resampleError) {
      timings.resample = Math.round(performance.now() - resampleStart);
      fail('resample', `Resampling failed: ${resampleError.message}`, {
        decodeMs: timings.decode,
        resampleMs: timings.resample,
        errorType: resampleError.name
      });
      return;
    }
    
    // =========================================================================
    // Step 3: ENCODE as WAV
    // =========================================================================
    console.log('[WAV Worker] Step 3: Encoding WAV...');
    const encodeStart = performance.now();
    
    const wavBuffer = encodeWav(samples, TARGET_SAMPLE_RATE);
    timings.encode = Math.round(performance.now() - encodeStart);
    timings.total = Math.round(performance.now() - startTime);
    
    // Track input size before it might be detached
    const inputSize = arrayBuffer.byteLength;
    
    console.log('[WAV Worker] Success!', {
      inputSize,
      outputSize: wavBuffer.byteLength,
      timingsMs: timings
    });
    
    // Transfer ownership for zero-copy
    self.postMessage({
      id,
      ok: true,
      wavBuffer,
      stats: {
        inputSize,
        outputSize: wavBuffer.byteLength,
        duration: audioBuffer.duration.toFixed(2),
        originalSampleRate: audioBuffer.sampleRate,
        targetSampleRate: TARGET_SAMPLE_RATE,
      },
      timingsMs: timings,
    }, [wavBuffer]); // Transfer wavBuffer ownership
    
  } catch (error) {
    timings.total = Math.round(performance.now() - startTime);
    fail('unexpected', error.message || 'Unknown error during WAV conversion', {
      decodeMs: timings.decode,
      resampleMs: timings.resample,
      encodeMs: timings.encode,
      errorType: error.name
    });
  }
};

/**
 * Encode Float32Array samples as WAV (16-bit PCM)
 */
function encodeWav(samples, sampleRate) {
  const numChannels = 1; // Force mono
  const bitsPerSample = 16;
  
  const numSamples = samples.length;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const bufferSize = 44 + dataSize; // 44 bytes for WAV header
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // File size - 8
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write audio samples (convert float to 16-bit PCM)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamp to [-1, 1] and convert to 16-bit
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}