// Worker import for Vite/CRA
declare module '*.worker.js' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}

// If you new Worker('/compress.worker.js'), Vite-friendly URL:
declare const importMetaUrl: string;

// Optional: OffscreenCanvas for older TS libs (harmless if already present)
interface OffscreenCanvas extends EventTarget {
  width: number;
  height: number;
  getContext(contextId: '2d'): OffscreenCanvasRenderingContext2D | null;
  convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob>;
}
