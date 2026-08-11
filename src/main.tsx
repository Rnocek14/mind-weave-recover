import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAudioUnlock } from "./lib/audioUnlock";
import { AppErrorBoundary, installGlobalErrorHandlers } from "./components/AppErrorBoundary";
import { initTextScale } from "./lib/textScale";

// Dev-only: Load phoneme coverage analysis for console access
if (import.meta.env.DEV) {
  import('./lib/phonemeCoverageAnalysis');
}

// Prime audio on first user gesture so TTS survives mobile exercise transitions
installAudioUnlock();

// Apply the persisted text-size setting before first paint
initTextScale();

// Offline tolerance + install criteria. Prod only — a SW in dev fights HMR.
// sw.js is network-first for navigations, so a deploy is never masked.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failure just means no offline support */
    });
  });
}

// Capture errors that never reach the React tree (async, event handlers)
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
