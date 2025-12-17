import { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  audioUrl: string | null;
  isPlaying: boolean;
  progress: number; // 0-1
  className?: string;
  barCount?: number;
  onSeek?: (progress: number) => void;
}

export const AudioWaveform = ({ 
  audioUrl, 
  isPlaying, 
  progress, 
  className = '',
  barCount = 40,
  onSeek
}: AudioWaveformProps) => {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekProgress = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(seekProgress);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const idx = Math.floor((hoverX / rect.width) * waveformData.length);
    setHoverIndex(Math.max(0, Math.min(waveformData.length - 1, idx)));
  };

  return (
    <div 
      ref={containerRef}
      className={`flex items-center gap-[2px] h-8 ${onSeek ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      {waveformData.map((amplitude, index) => {
        const isPlayed = index <= progressIndex;
        const isHovered = hoverIndex !== null && index <= hoverIndex;
        const height = Math.max(4, amplitude * 28);
        
        return (
          <div
            key={index}
            className={`w-[3px] rounded-full transition-all duration-100 ${
              isPlayed 
                ? 'bg-primary' 
                : isHovered && onSeek
                  ? 'bg-primary/50'
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
