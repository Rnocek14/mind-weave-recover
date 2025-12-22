import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Dev-only: Load phoneme coverage analysis for console access
if (import.meta.env.DEV) {
  import('./lib/phonemeCoverageAnalysis');
}

createRoot(document.getElementById("root")!).render(<App />);
