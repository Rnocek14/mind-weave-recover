import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUiMode } from "@/hooks/useUiMode";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { UiMode } from "@/contexts/UiModeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Users, Stethoscope, Settings } from "lucide-react";

const MODE_CONFIG: Record<UiMode, { label: string; icon: typeof User; description: string }> = {
  patient: {
    label: "Patient",
    icon: User,
    description: "Simplified recovery view",
  },
  caregiver: {
    label: "Caregiver",
    icon: Users,
    description: "Progress tracking & support",
  },
  clinician: {
    label: "Clinician",
    icon: Stethoscope,
    description: "Diagnostic deep dive",
  },
  admin: {
    label: "Admin",
    icon: Settings,
    description: "System & pipeline health",
  },
};

export function ViewModeSelector() {
  const { uiMode, setUiMode } = useUiMode();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isClinician, isCaregiver } = useUserPermissions(user?.id);

  // Only surface modes the user is actually entitled to (DB roles).
  // uiMode is presentation only; offering a mode the route guard will
  // reject would dump the user into a redirect/dead-state.
  const availableModes: UiMode[] = [
    'patient',
    ...(isCaregiver ? ['caregiver' as UiMode] : []),
    ...(isClinician ? ['clinician' as UiMode] : []),
    ...(isAdmin ? ['admin' as UiMode] : []),
  ];

  // If the active uiMode is no longer permitted, fall back to the highest
  // mode the user can still use (defaults to patient).
  useEffect(() => {
    if (!availableModes.includes(uiMode)) {
      setUiMode(availableModes[availableModes.length - 1] ?? 'patient');
    }
  }, [uiMode, availableModes, setUiMode]);


  return (
    <Select value={uiMode} onValueChange={(value) => {
      const mode = value as UiMode;
      setUiMode(mode);
      // Navigate to the appropriate home for the new role
      const target =
        mode === 'admin' ? '/admin'
        : mode === 'clinician' ? '/clinician/review'
        : mode === 'caregiver' ? '/caregiver'
        : '/dashboard';
      navigate(target);
    }}>
      <SelectTrigger className="w-[140px] h-9">
        <SelectValue>
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = MODE_CONFIG[uiMode].icon;
              return <Icon className="h-4 w-4" />;
            })()}
            <span className="text-sm">{MODE_CONFIG[uiMode].label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableModes.map((mode) => {
          const { label, icon: Icon, description } = MODE_CONFIG[mode];
          return (
            <SelectItem key={mode} value={mode}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
