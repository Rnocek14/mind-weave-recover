/**
 * useUiModeEntitlement - Syncs uiMode with actual database entitlements
 * 
 * Purpose: If a user's localStorage has uiMode='caregiver' but they don't have
 * the caregiver role in the database, this hook auto-corrects to 'patient'.
 * 
 * Naming conventions (for future devs):
 * - canUseCaregiverMode: DB role entitlement (from useUserPermissions)
 * - isCaregiverModeActive: current uiMode state (from useUiMode)
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUiMode } from "@/hooks/useUiMode";

export function useUiModeEntitlement() {
  const { user } = useAuth();
  const { isCaregiver: canUseCaregiverMode, isLoading } = useUserPermissions(user?.id);
  const { uiMode, setUiMode } = useUiMode();
  
  const didCorrect = useRef(false);
  
  useEffect(() => {
    // Wait until permissions are loaded
    if (isLoading || !user) return;
    
    // Only run correction once per session
    if (didCorrect.current) return;
    
    // If uiMode is caregiver+ but user lacks entitlement, reset to patient
    const isCaregiverModeActive = uiMode === 'caregiver' || uiMode === 'clinician';
    
    if (isCaregiverModeActive && !canUseCaregiverMode) {
      console.info('[UiModeEntitlement] User lacks caregiver role, resetting uiMode to patient');
      setUiMode('patient');
      didCorrect.current = true;
    }
  }, [isLoading, user, uiMode, canUseCaregiverMode, setUiMode]);
  
  return {
    canUseCaregiverMode,
    isCaregiverModeActive: uiMode === 'caregiver' || uiMode === 'clinician' || uiMode === 'admin',
  };
}
