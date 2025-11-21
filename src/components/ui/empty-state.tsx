import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title?: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'info' | 'prompt' | 'warning';
  className?: string;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  variant = 'info',
  className,
}: EmptyStateProps) => {
  const variantStyles = {
    info: "bg-muted/50 text-muted-foreground",
    prompt: "bg-primary/5 border-primary/20 text-foreground",
    warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
  };

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border animate-fade-in",
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-2">
        {title && (
          <p className="font-medium text-sm">{title}</p>
        )}
        <p className="text-sm leading-relaxed">{description}</p>
        {action && (
          <Button
            onClick={action.onClick}
            variant={variant === 'prompt' ? 'default' : 'outline'}
            size="sm"
            className="mt-3 min-h-[44px] md:min-h-[40px]"
            aria-label={action.label}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
};