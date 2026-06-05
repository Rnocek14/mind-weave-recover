import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useUiMode } from "@/hooks/useUiMode";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function UiModeToggle() {
  const { uiMode, toggleMode } = useUiMode();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            aria-label="Switch view mode"
            className="relative"
          >
            <Users className="h-5 w-5" />
            {uiMode === 'caregiver' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {uiMode === 'patient' ? 'Patient Mode' : 'Caregiver Mode'}
          </p>
          <p className="text-xs text-muted-foreground">
            Click to switch to {uiMode === 'patient' ? 'Caregiver' : 'Patient'} Mode
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
