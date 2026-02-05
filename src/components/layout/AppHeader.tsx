import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Clock, 
  Settings, 
  Camera,
  FileText,
  Shield,
  History,
  ChevronDown,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUiMode } from "@/hooks/useUiMode";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/insights", label: "Insights", icon: TrendingUp },
  { href: "/history", label: "History", icon: Clock },
];

export function AppHeader() {
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin } = useUserPermissions(user?.id);
  const { isAtLeast } = useUiMode();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo/Brand */}
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <Brain className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">MindWeave</span>
        </Link>

        {/* Primary Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} to={item.href}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2",
                    active && "bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            );
          })}

          {/* Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover">
              <DropdownMenuItem asChild>
                <Link to="/photo-library" className="flex items-center gap-2 cursor-pointer">
                  <Camera className="h-4 w-4" />
                  Photo Library
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/clinical-documents" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  Clinical Documents
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings/privacy" className="flex items-center gap-2 cursor-pointer">
                  <Shield className="h-4 w-4" />
                  Privacy
                </Link>
              </DropdownMenuItem>
              
              {/* Show Profile History for caregivers+ */}
              {isAtLeast('caregiver') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile-history" className="flex items-center gap-2 cursor-pointer">
                      <History className="h-4 w-4" />
                      Profile History
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              
              {/* Admin tools for admins */}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Admin Tools
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
