import { useContext } from "react";
import { UiModeContext, UiModeContextValue } from "@/contexts/UiModeContext";

export function useUiMode(): UiModeContextValue {
  const context = useContext(UiModeContext);
  
  if (!context) {
    throw new Error("useUiMode must be used within a UiModeProvider");
  }
  
  return context;
}
