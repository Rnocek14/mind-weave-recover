import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ExerciseBackButtonProps {
  defaultTo?: string;
  className?: string;
}

/**
 * Smart back button for exercises that respects returnTo param.
 * 
 * Priority:
 * 1. returnTo param (if valid internal path)
 * 2. defaultTo fallback (more predictable than browser history for exercises)
 * 
 * Usage: Add ?returnTo=/insights?tab=progress when launching exercises
 * from places other than Dashboard.
 */
export function ExerciseBackButton({ 
  defaultTo = "/dashboard",
  className 
}: ExerciseBackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleBack = () => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("returnTo");
    
    // Safely decode - can throw on malformed input
    let decoded: string | null = null;
    try {
      decoded = raw ? decodeURIComponent(raw) : null;
    } catch {
      decoded = null;
    }
    
    // Security: only allow internal paths
    // - Must start with "/"
    // - Must NOT start with "//" (protocol-relative)
    // - Must NOT contain backslashes (Windows path injection)
    // - Must NOT contain control characters
    const isSafeInternal = 
      !!decoded &&
      decoded.startsWith("/") &&
      !decoded.startsWith("//") &&
      !decoded.includes("\\") &&
      !/[\u0000-\u001F\u007F]/.test(decoded);
    
    if (isSafeInternal) {
      navigate(decoded);
    } else {
      // For exercises, defaultTo is more predictable than browser history
      // which may point to auth redirects, modals, or other weird states
      navigate(defaultTo);
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleBack}
      className={className}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
  );
}
