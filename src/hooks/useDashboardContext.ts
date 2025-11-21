import { useContext } from "react";
import { DashboardContext, DashboardContextValue } from "@/contexts/DashboardContext";

export function useDashboardContext(): DashboardContextValue {
  const context = useContext(DashboardContext);
  
  if (!context) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  
  return context;
}
