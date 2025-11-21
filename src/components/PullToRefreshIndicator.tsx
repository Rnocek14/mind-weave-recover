import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  pullProgress: number;
}

export const PullToRefreshIndicator = ({
  pullDistance,
  isRefreshing,
  pullProgress,
}: PullToRefreshIndicatorProps) => {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-transform bg-gradient-calm"
      style={{
        transform: `translateY(${pullDistance - 60}px)`,
        height: "60px",
      }}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-medium text-foreground transition-all",
          isRefreshing && "animate-fade-in"
        )}
      >
        {isRefreshing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Refreshing...</span>
          </>
        ) : (
          <>
            <ArrowDown
              className="h-5 w-5 text-primary transition-transform"
              style={{
                transform: `rotate(${pullProgress * 180}deg)`,
              }}
            />
            <span>{pullProgress >= 1 ? "Release to refresh" : "Pull to refresh"}</span>
          </>
        )}
      </div>
    </div>
  );
};
