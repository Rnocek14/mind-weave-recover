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
    const returnTo = params.get("returnTo") || defaultTo;
    navigate(returnTo);
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
