import { useUiMode } from "@/hooks/useUiMode";
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
        {(Object.keys(MODE_CONFIG) as UiMode[]).map((mode) => {
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
