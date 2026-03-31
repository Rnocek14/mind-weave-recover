import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSessionProgress } from "@/hooks/useSessionProgress";

export function InlineSessionProgress() {
  const { completedCount, totalCount, elapsedMinutes } = useSessionProgress();

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 border-t border-border/40">
      <div className="flex gap-1">
        {Array.from({ length: totalCount }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i < completedCount ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      <Separator orientation="vertical" className="h-3" />
      <span className="text-xs font-medium text-muted-foreground">{elapsedMinutes}m</span>
    </div>
  );
}
