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
 * 2. Browser history (navigate(-1))
 * 3. defaultTo fallback
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
    const decoded = raw ? decodeURIComponent(raw) : null;
    
    // Only allow internal paths (starts with "/" but not "//")
    const isSafeInternal = decoded && decoded.startsWith("/") && !decoded.startsWith("//");
    
    if (isSafeInternal) {
      navigate(decoded);
    } else if (window.history.length > 1) {
      // Use browser history if available
      navigate(-1);
    } else {
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
