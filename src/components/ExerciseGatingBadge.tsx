import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExerciseGatingBadgeProps {
  isAccessible: boolean;
  reason?: string;
  alternative?: string;
  hasAdaptations?: boolean;
  adaptationCount?: number;
}

export const ExerciseGatingBadge = ({ 
  isAccessible, 
  reason, 
  alternative,
  hasAdaptations,
  adaptationCount = 0,
}: ExerciseGatingBadgeProps) => {
  if (isAccessible && hasAdaptations && adaptationCount > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Adapted ({adaptationCount})
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Exercise automatically adapted to your current capabilities
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!isAccessible) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs font-semibold mb-1">{reason}</p>
            {alternative && (
              <p className="text-xs text-muted-foreground">
                Try "{alternative}" instead
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
};
