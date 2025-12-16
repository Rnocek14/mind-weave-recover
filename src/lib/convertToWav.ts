/**
 * Converts any audio Blob (WebM/Opus, etc.) to WAV format
 * suitable for Azure Pronunciation Assessment API.
 * 
 * Azure requires: 16kHz mono PCM WAV for best phoneme-level analysis.
 */

const TARGET_SAMPLE_RATE = 16000;

/**
 * Convert an audio Blob to WAV format
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  // Create AudioContext with target sample rate
  const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  
  try {
    // Decode the source audio
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to mono 16-bit PCM WAV
    const wavBuffer = encodeWav(audioBuffer);
    
    console.log('🎵 Audio converted to WAV:', {
      originalSize: blob.size,
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
  const numChannels = 1; // Force mono
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  
  // Get audio data (mix down to mono if stereo)
  let samples: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0);
  } else {
    // Mix stereo to mono
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

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
