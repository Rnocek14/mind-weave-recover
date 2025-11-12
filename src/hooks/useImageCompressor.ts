import { useEffect, useRef } from "react";

export function useImageCompressor() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker("/compress.worker.js");
    
    return () => {
      // Cleanup worker on unmount
      workerRef.current?.terminate();
    };
  }, []);

  const compress = (file: File, maxSize = 1600, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const worker = workerRef.current;
      const timeout = setTimeout(() => {
        reject(new Error("Compression timeout after 15 seconds"));
      }, 15000);

      const onMessage = (e: MessageEvent) => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.compressed as File);
        }
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({ file, maxSize, quality });
    });
  };

  return compress;
}
