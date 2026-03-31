import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSessionProgress } from "@/hooks/useSessionProgress";

export function SessionProgressBubble() {
  const { completedCount, totalCount, elapsedMinutes } = useSessionProgress();
  
  // Don't render if no lesson data
  if (totalCount === 0) return null;
  
  return (
    <div className="fixed top-[60px] right-3 z-40">
      <Card className="flex items-center gap-1.5 px-2 py-1 shadow-md bg-card/90 backdrop-blur-sm border text-xs">
        <div className="flex gap-1">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                i < completedCount ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-sm font-medium text-foreground">{elapsedMinutes}m</span>
      </Card>
    </div>
  );
}
