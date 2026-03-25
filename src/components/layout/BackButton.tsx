import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUiMode } from "@/hooks/useUiMode";

interface BackButtonProps {
  /** Override the default role-aware target */
  to?: string;
  /** Label shown next to arrow. Defaults to "Back" */
  label?: string;
  className?: string;
}

/**
 * Role-aware back button.
 * 
 * Default targets:
 *   patient    → /dashboard
 *   caregiver  → /caregiver  
 *   clinician  → /clinician/review
 *   admin      → /admin
 */
export function BackButton({ to, label = "Back", className }: BackButtonProps) {
  const navigate = useNavigate();
  const { uiMode } = useUiMode();

  const defaultTarget =
    uiMode === "admin" ? "/admin"
    : uiMode === "clinician" ? "/clinician/review"
    : uiMode === "caregiver" ? "/caregiver"
    : "/dashboard";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(to || defaultTarget)}
      className={className}
    >
      <ArrowLeft className="h-4 w-4 mr-1.5" />
      {label}
    </Button>
  );
}
