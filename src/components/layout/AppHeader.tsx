import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
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
  Brain,
  Stethoscope,
  CircleHelp,
  LogOut,
  HeartPulse,
  Sparkles } from
"lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUiMode } from "@/hooks/useUiMode";
import { useHelpMode } from "@/contexts/HelpModeContext";
import { useKidsMode } from "@/contexts/KidsModeContext";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ViewModeSelector } from "@/components/ViewModeSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Patient uses bottom tab bar — no header nav items needed
const patientNavItems: typeof clinicianNavItems = [];

const caregiverNavItems = [
  { href: "/caregiver", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard", label: "Recovery", icon: HeartPulse },
];

const clinicianNavItems = [
  { href: "/clinician/caseload", label: "Caseload", icon: Stethoscope },
  { href: "/clinician/review", label: "Review", icon: FileText },
];


export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isCaregiver } = useUserPermissions(user?.id);
  const { isAtLeast, uiMode } = useUiMode();
  const { helpMode, toggleHelpMode } = useHelpMode();
  const { kidsMode, toggleKidsMode } = useKidsMode();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  // Show caregiver toggle only for users with caregiver+ database role
  const canAccessCaregiverMode = isCaregiver;

  const navItems = uiMode === 'clinician' || uiMode === 'admin'
    ? clinicianNavItems
    : uiMode === 'caregiver'
    ? caregiverNavItems
    : patientNavItems;
  const homeHref = uiMode === 'clinician' || uiMode === 'admin'
    ? "/clinician/caseload"
    : uiMode === 'caregiver'
    ? "/caregiver"
    : "/dashboard";

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
        <Link to={homeHref} className="flex items-center gap-2 font-semibold">
          <Brain className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">NeuroRecover</span>
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
                  )}>
                  
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>);

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
              {/* Privacy is always visible */}
              <DropdownMenuItem asChild>
                <Link to="/settings/privacy" className="flex items-center gap-2 cursor-pointer">
                  <Shield className="h-4 w-4" />
                  Privacy
                </Link>
              </DropdownMenuItem>
              
              {/* Kids Mode — playful theme + kid-friendly game content */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault(); // keep menu open so the switch flip is visible
                  toggleKidsMode();
                }}
                className="flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Kids Mode
                </span>
                <Switch
                  checked={kidsMode}
                  aria-label={kidsMode ? "Turn off Kids Mode" : "Turn on Kids Mode"}
                  className="pointer-events-none"
                  tabIndex={-1}
                />
              </DropdownMenuItem>

              {/* Photo Library and Clinical Docs for caregivers+ (reduces cognitive load for patients) */}
              {isAtLeast('caregiver') &&
              <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/photo-library" className="flex items-center gap-2 cursor-pointer">
                      <Camera className="h-4 w-4" />
                      Photo Library
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/clinical-documents" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="h-4 w-4" />
                      Medical Documents
                    </Link>
                  </DropdownMenuItem>
                </>
              }
              
              {/* Show Profile History for caregivers+ */}
              {isAtLeast('caregiver') &&
              <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile-history" className="flex items-center gap-2 cursor-pointer">
                      <History className="h-4 w-4" />
                      Profile History
                    </Link>
                  </DropdownMenuItem>
                </>
              }
              
              {/* Deep-link access to Insights, Recovery, History for caregivers+ */}
              {isAtLeast('caregiver') &&
              <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/insights" className="flex items-center gap-2 cursor-pointer">
                      <TrendingUp className="h-4 w-4" />
                      Insights
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/recovery-progress" className="flex items-center gap-2 cursor-pointer">
                      <HeartPulse className="h-4 w-4" />
                      Recovery Progress
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/history" className="flex items-center gap-2 cursor-pointer">
                      <Clock className="h-4 w-4" />
                      Session History
                    </Link>
                  </DropdownMenuItem>
                </>
              }
              
              {/* Caseload in settings only if NOT already in clinician nav */}
              {isAtLeast('clinician') && !(uiMode === 'clinician' || uiMode === 'admin') &&
              <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/clinician/caseload" className="flex items-center gap-2 cursor-pointer">
                      <Stethoscope className="h-4 w-4" />
                      Caseload
                    </Link>
                  </DropdownMenuItem>
                </>
              }
              
              {/* Admin tools for admins */}
              {isAdmin &&
              <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Admin Tools
                    </Link>
                  </DropdownMenuItem>
                </>
              }

              {/* Log out — always available */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>


          {/* Global View Mode Selector */}
          <ViewModeSelector />

          {/* Help Mode Toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={helpMode ? "secondary" : "ghost"}
                  size="icon"
                  className={cn(helpMode && "text-primary")}
                  onClick={toggleHelpMode}
                  aria-label={helpMode ? "Turn off help tooltips" : "Turn on help tooltips"}
                >
                  <CircleHelp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {helpMode ? "Hide explanations" : "Show explanations for complex terms"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ThemeToggle />
        </nav>
      </div>
    </header>);

}