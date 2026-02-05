import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: ReactNode;
  /** Hide header for full-screen experiences like exercises */
  hideHeader?: boolean;
}

export function AppLayout({ children, hideHeader = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <AppHeader />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
