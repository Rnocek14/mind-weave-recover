/**
 * Caregiver Mode Toggle - Appears in header for eligible users
 * 
 * Allows caregiver+ users to switch between Patient and Caregiver views
 * without needing to navigate to /caregiver route.
 */

import { useNavigate, useLocation } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { useUiMode } from "@/hooks/useUiMode";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CaregiverModeToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { uiMode, setUiMode } = useUiMode();
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id || null);
  
  const isCaregiverMode = uiMode === 'caregiver' || uiMode === 'clinician' || uiMode === 'admin';
  
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Switching TO caregiver mode
      setUiMode('caregiver');
      
      // Smart navigation: go to alerts if they exist, otherwise stay put
      // Only navigate if not already on a caregiver-friendly page
      if (!flagsLoading && redFlags.length > 0 && !location.pathname.startsWith('/insights')) {
        navigate('/insights?tab=alerts');
      }
      // If already on insights/dashboard, just toggle mode (tabs will adjust)
    } else {
      // Switching TO patient mode
      setUiMode('patient');
      
      // If on caregiver-specific pages, redirect to dashboard
      if (location.pathname.startsWith('/caregiver')) {
        navigate('/dashboard');
      }
      // Otherwise stay on current page (tabs will auto-hide caregiver-only content)
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-2">
            <Switch
              id="caregiver-mode"
              checked={isCaregiverMode}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-primary"
            />
            <Label 
              htmlFor="caregiver-mode" 
              className="text-xs cursor-pointer flex items-center gap-1.5"
            >
              <Heart className="h-3 w-3" />
              <span className="hidden sm:inline">Caregiver</span>
              {isCaregiverMode && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1">
                  ON
                </Badge>
              )}
            </Label>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="font-medium">
            {isCaregiverMode ? 'Caregiver View Active' : 'Patient View Active'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isCaregiverMode 
              ? 'Showing detailed monitoring & tools' 
              : 'Showing simplified recovery view'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
