import { useEffect, useRef } from "react";

export function useImageCompressor() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Vite-friendly path; keeps TS happy
    workerRef.current = new Worker(new URL('/compress.worker.js', import.meta.url), { type: 'module' });
    return () => workerRef.current?.terminate();
  }, []);

  const compress = (file: File, maxSize = 1600, quality = 0.7): Promise<File> =>
    new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) return reject(new Error('Worker not initialized'));

      const timeout = setTimeout(() => reject(new Error('Compression timeout after 15 seconds')), 15000);

      const onMessage = (e: MessageEvent) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', onMessage);
        if ((e.data as any)?.error) reject(new Error((e.data as any).error));
        else resolve((e.data as any).compressed as File);
      };

      worker.addEventListener('message', onMessage);
      worker.postMessage({ file, maxSize, quality });
    });

  return compress;
}
