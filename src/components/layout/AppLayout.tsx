import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { useUiModeEntitlement } from "@/hooks/useUiModeEntitlement";

interface AppLayoutProps {
  children: ReactNode;
  /** Hide header for full-screen experiences like exercises */
  hideHeader?: boolean;
}

export function AppLayout({ children, hideHeader = false }: AppLayoutProps) {
  // Auto-correct uiMode if user lacks entitlement (e.g., localStorage says caregiver but DB says no)
  useUiModeEntitlement();
  
  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <AppHeader />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
