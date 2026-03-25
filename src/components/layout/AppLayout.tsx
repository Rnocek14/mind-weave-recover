import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { useUiModeEntitlement } from "@/hooks/useUiModeEntitlement";
import { useUiMode } from "@/hooks/useUiMode";

interface AppLayoutProps {
  children: ReactNode;
  /** Hide header for full-screen experiences like exercises */
  hideHeader?: boolean;
}

export function AppLayout({ children, hideHeader = false }: AppLayoutProps) {
  // Auto-correct uiMode if user lacks entitlement (e.g., localStorage says caregiver but DB says no)
  useUiModeEntitlement();
  const { uiMode } = useUiMode();
  
  // Patient mode uses its own bottom tab bar — suppress the header entirely
  const shouldHideHeader = hideHeader || uiMode === 'patient';
  
  return (
    <div className="min-h-screen flex flex-col">
      {!shouldHideHeader && <AppHeader />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
