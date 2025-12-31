/**
 * Web Worker for WebM/Opus → WAV conversion
 * Runs off main thread to prevent UI blocking during audio processing.
 * 
 * Azure Pronunciation Assessment requires 16kHz mono PCM WAV.
 */

const TARGET_SAMPLE_RATE = 16000;

self.onmessage = async (e) => {
  const { arrayBuffer, id } = e.data;
  
  console.log('[WAV Worker] Received request', { id, byteLength: arrayBuffer?.byteLength });
  
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    self.postMessage({
      id,
      success: false,
      error: 'Empty or missing audio data',
    });
    return;
  }
  
  try {
    // Create AudioContext with target sample rate
    console.log('[WAV Worker] Creating OfflineAudioContext...');
    const audioContext = new OfflineAudioContext(1, 1, TARGET_SAMPLE_RATE);
    
    // Decode the source audio
    console.log('[WAV Worker] Decoding audio data...');
    let audioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('[WAV Worker] Decoded:', { 
        duration: audioBuffer.duration, 
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels 
      });
    } catch (decodeError) {
      console.error('[WAV Worker] decodeAudioData failed:', decodeError);
      self.postMessage({
        id,
        success: false,
        error: `Audio decode failed: ${decodeError.message || 'Unknown format'}`,
      });
      return;
    }
    
    // Resample to target rate if needed
    let samples;
    if (audioBuffer.sampleRate !== TARGET_SAMPLE_RATE) {
      console.log('[WAV Worker] Resampling from', audioBuffer.sampleRate, 'to', TARGET_SAMPLE_RATE);
      // Need to resample - use OfflineAudioContext for proper resampling
      const offlineCtx = new OfflineAudioContext(
        1, // mono
        Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE),
        TARGET_SAMPLE_RATE
      );
      
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      
      const resampledBuffer = await offlineCtx.startRendering();
      samples = resampledBuffer.getChannelData(0);
      console.log('[WAV Worker] Resampling complete:', { samples: samples.length });
    } else {
      // Mix to mono if needed
      if (audioBuffer.numberOfChannels === 1) {
        samples = audioBuffer.getChannelData(0);
      } else {
        console.log('[WAV Worker] Mixing stereo to mono');
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        samples = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
          samples[i] = (left[i] + right[i]) / 2;
        }
      }
    }
    
    // Encode as WAV
    console.log('[WAV Worker] Encoding WAV...');
    const wavBuffer = encodeWav(samples, TARGET_SAMPLE_RATE);
    
    console.log('[WAV Worker] Success!', {
      inputSize: arrayBuffer.byteLength,
      outputSize: wavBuffer.byteLength,
    });
    
    self.postMessage({
      id,
      success: true,
      wavBuffer,
      stats: {
        inputSize: arrayBuffer.byteLength,
        outputSize: wavBuffer.byteLength,
        duration: audioBuffer.duration.toFixed(2),
        originalSampleRate: audioBuffer.sampleRate,
        targetSampleRate: TARGET_SAMPLE_RATE,
      },
    });
  } catch (error) {
    console.error('[WAV Worker] Unexpected error:', error);
    self.postMessage({
      id,
      success: false,
      error: error.message || 'Unknown error during WAV conversion',
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
