import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSessionProgress } from "@/hooks/useSessionProgress";

export function SessionProgressBubble() {
  const { completedCount, totalCount, elapsedMinutes } = useSessionProgress();
  
  // Don't render if no lesson data
  if (totalCount === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-50">
      <Card className="flex items-center gap-2 px-3 py-2 shadow-lg bg-card/95 backdrop-blur-sm border">
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
