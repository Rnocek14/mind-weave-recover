import { useContext } from "react";
import { UiModeContext, UiModeContextValue, UiMode } from "@/contexts/UiModeContext";

export function useUiMode(): UiModeContextValue {
  const context = useContext(UiModeContext);
  
  if (!context) {
    throw new Error("useUiMode must be used within a UiModeProvider");
  }
  
  return context;
}

// Re-export UiMode type for convenience
export type { UiMode };
