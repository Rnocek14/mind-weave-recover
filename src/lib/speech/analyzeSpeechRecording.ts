import { supabase } from '@/integrations/supabase/client';
import { convertBlobToWav } from '@/lib/convertToWav';
import { readSpeechMeasurements, type SpeechMeasurements } from './analysisResponse';

/** Analyze the real captured audio in Azure's supported PCM WAV format. */
export async function analyzeSpeechRecording(audioBlob: Blob): Promise<SpeechMeasurements | null> {
  try {
    const wav = await convertBlobToWav(audioBlob);
    const audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : undefined;
        if (!base64) reject(new Error('Empty encoded speech recording'));
        else resolve(base64);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read speech recording'));
      reader.onabort = () => reject(new Error('Speech recording read was aborted'));
      reader.readAsDataURL(wav);
    });
    const { data, error } = await supabase.functions.invoke('analyze-speech', {
      body: { audioBlob: audio, mimeType: 'audio/wav' },
    });
    if (error) throw error;
    return readSpeechMeasurements(data);
  } catch (error) {
    console.warn('Speech analysis unavailable:', error instanceof Error ? error.message : error);
    return null;
  }
}
