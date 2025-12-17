import { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  audioUrl: string | null;
  isPlaying: boolean;
  progress: number; // 0-1
  className?: string;
  barCount?: number;
}

export const AudioWaveform = ({ 
  audioUrl, 
  isPlaying, 
  progress, 
  className = '',
  barCount = 40 
}: AudioWaveformProps) => {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!audioUrl) {
      // Generate placeholder waveform
      setWaveformData(Array.from({ length: barCount }, () => Math.random() * 0.5 + 0.2));
      return;
    }

    const analyzeAudio = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get the raw audio data from the first channel
        const rawData = audioBuffer.getChannelData(0);
        const samplesPerBar = Math.floor(rawData.length / barCount);
        
        // Calculate RMS for each bar
        const bars: number[] = [];
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, rawData.length);
          
          for (let j = start; j < end; j++) {
            sum += rawData[j] * rawData[j];
          }
          
          const rms = Math.sqrt(sum / (end - start));
          bars.push(rms);
        }
        
        // Normalize to 0-1 range
        const max = Math.max(...bars, 0.01);
        const normalized = bars.map(b => Math.max(0.1, b / max));
        
        setWaveformData(normalized);
        audioContext.close();
      } catch (error) {
        console.error('Failed to analyze audio:', error);
        // Fallback to placeholder
        setWaveformData(Array.from({ length: barCount }, () => Math.random() * 0.5 + 0.2));
      } finally {
        setIsLoading(false);
      }
    };

    analyzeAudio();
  }, [audioUrl, barCount]);

  const progressIndex = Math.floor(progress * waveformData.length);

  return (
    <div className={`flex items-center gap-[2px] h-8 ${className}`}>
      {waveformData.map((amplitude, index) => {
        const isPlayed = index <= progressIndex;
        const height = Math.max(4, amplitude * 28);
        
        return (
          <div
            key={index}
            className={`w-[3px] rounded-full transition-all duration-150 ${
              isPlayed 
                ? 'bg-primary' 
                : 'bg-muted-foreground/30'
            } ${isPlaying && isPlayed ? 'animate-pulse' : ''}`}
            style={{ 
              height: `${height}px`,
              opacity: isLoading ? 0.5 : 1
            }}
          />
        );
      })}
    </div>
  );
};
