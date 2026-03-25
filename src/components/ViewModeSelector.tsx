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
  const { user } = useAuth();
  const { isAdmin } = useUserPermissions(user?.id);

  // Filter available modes based on real permissions
  // Admin mode only available to actual admins
  const availableModes: UiMode[] = isAdmin 
    ? ['patient', 'caregiver', 'clinician', 'admin']
    : ['patient', 'caregiver', 'clinician'];

  // If user is in admin mode but lost admin permission, reset to clinician
  useEffect(() => {
    if (uiMode === 'admin' && !isAdmin) {
      setUiMode('clinician');
    }
  }, [uiMode, isAdmin, setUiMode]);

  return (
    <Select value={uiMode} onValueChange={(value) => setUiMode(value as UiMode)}>
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
