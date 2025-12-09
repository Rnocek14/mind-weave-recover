import { useState, useEffect, useMemo } from 'react';

interface SessionProgress {
  completedCount: number;
  totalCount: number;
  elapsedMinutes: number;
  progress: number;
}

export function useSessionProgress(): SessionProgress {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  
  const lessonState = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('lessonFlowState');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);
  
  const sessionStartTime = lessonState?.sessionStartTime || null;
  const blocks = lessonState?.lesson?.blocks || [];
  const currentIndex = lessonState?.currentBlockIndex || 0;
  
  useEffect(() => {
    if (!sessionStartTime) return;
    
    // Calculate initial elapsed time
    setElapsedMinutes(Math.floor((Date.now() - sessionStartTime) / 60000));
    
    const interval = setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - sessionStartTime) / 60000));
    }, 10000);
    
    return () => clearInterval(interval);
  }, [sessionStartTime]);
  
  return {
    completedCount: currentIndex,
    totalCount: blocks.length,
    elapsedMinutes,
    progress: blocks.length > 0 ? (currentIndex / blocks.length) * 100 : 0
  };
}
