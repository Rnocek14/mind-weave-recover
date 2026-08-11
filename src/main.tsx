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

// Capture errors that never reach the React tree (async, event handlers)
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
