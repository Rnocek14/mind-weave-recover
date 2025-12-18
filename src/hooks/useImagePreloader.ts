import { useEffect, useRef } from 'react';

/**
 * Preloads the next image while current trial is active
 * to eliminate visual delay when advancing
 */
export const useImagePreloader = (currentImagePath: string | undefined, nextImagePath: string | undefined) => {
  const preloadedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // Preload current image if not already loaded
    if (currentImagePath && !preloadedRef.current.has(currentImagePath)) {
      const img = new Image();
      img.src = currentImagePath;
      img.onload = () => {
        preloadedRef.current.add(currentImagePath);
      };
    }
    
    // Preload next image ahead of time
    if (nextImagePath && !preloadedRef.current.has(nextImagePath)) {
      const img = new Image();
      img.src = nextImagePath;
      img.onload = () => {
        preloadedRef.current.add(nextImagePath);
        console.log('🖼️ Preloaded next image:', nextImagePath);
      };
    }
  }, [currentImagePath, nextImagePath]);
  
  return {
    isPreloaded: (path: string) => preloadedRef.current.has(path)
  };
};
