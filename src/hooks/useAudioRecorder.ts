import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecordingResult {
  audioBlob: Blob;
  duration: number;
  mimeType: string;
}

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const unmountedRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  // Never leave a native microphone live when a patient exits a game.
  // This also protects against getUserMedia resolving after an unmount.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (!recorder) return;
      recorder.stream.getTracks().forEach(track => track.stop());
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* already stopped by the browser */ }
      }
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    let stream: MediaStream | null = null;
    try {
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        console.warn('Audio recording not supported in this browser');
        return false;
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        // A delayed permission prompt can resolve after the patient leaves.
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      // Choose best available MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      return true;
    } catch (error) {
      // MediaRecorder construction/start can fail after getUserMedia succeeds.
      // Reclaim the newly acquired mic even on that exceptional path.
      stream?.getTracks().forEach(track => track.stop());
      console.error('Failed to start recording:', error);
      if (!unmountedRef.current) toast.error('Could not start recording', {
        description: 'Please check microphone permissions',
        id: 'mic-error', // Dedupe: only show one mic error at a time
      });
      return false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        if (!unmountedRef.current) setIsRecording(false);
        mediaRecorderRef.current = null;
        
        resolve({
          audioBlob,
          duration,
          mimeType: mediaRecorder.mimeType
        });
      };

      mediaRecorder.stop();
    });
  }, []);

  const uploadRecording = useCallback(async (
    audioBlob: Blob,
    userId: string,
    sessionId: string,
    trialNumber: number,
    mimeType: string
  ): Promise<string | null> => {
    try {
      const fileExtension = mimeType.includes('webm') ? 'webm' : 
                           mimeType.includes('mp4') ? 'mp4' : 'webm';
      
      const timestamp = Date.now();
      const filePath = `${userId}/${sessionId}/trial-${trialNumber}-${timestamp}.${fileExtension}`;

      const { data, error } = await supabase.storage
        .from('session-recordings')
        .upload(filePath, audioBlob, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      return data.path;
    } catch (error) {
      console.error('Failed to upload recording:', error);
      return null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder.stop();
    }
    
    chunksRef.current = [];
    setIsRecording(false);
    mediaRecorderRef.current = null;
  }, []);

  return {
    isRecording,
    isSupported,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording
  };
};
