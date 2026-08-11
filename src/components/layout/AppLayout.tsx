import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const { uiMode } = useUiMode();
  const roleRoute = location.pathname.startsWith('/caregiver') || location.pathname.startsWith('/clinician') || location.pathname.startsWith('/admin');
  
  // Patient mode uses its own bottom tab bar — suppress the header entirely
  const shouldHideHeader = hideHeader || (uiMode === 'patient' && !roleRoute);
  
  return (
    <div className="min-h-dvh flex flex-col">
      {!shouldHideHeader && <AppHeader />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
