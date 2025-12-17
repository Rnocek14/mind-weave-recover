import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bug } from "lucide-react";

interface CueDebugOverlayProps {
  visible: boolean;
  stallDetected: boolean;
  consecutiveErrors: number;
  autoCueShownThisTrial: boolean;
  cueLevel: number;
  cueType: string | null;
  cueTrigger: 'stall' | 'consecutive_errors' | 'user_request' | null;
  cueShownAt: number | null;
  trialNumber: number;
}

export function CueDebugOverlay({
  visible,
  stallDetected,
  consecutiveErrors,
  autoCueShownThisTrial,
  cueLevel,
  cueType,
  cueTrigger,
  cueShownAt,
  trialNumber
}: CueDebugOverlayProps) {
  if (!visible) return null;

  const timeSinceCue = cueShownAt ? Math.round((Date.now() - cueShownAt) / 1000) : null;

  return (
    <Card className="fixed bottom-20 left-4 z-50 p-3 bg-background/95 backdrop-blur border-2 border-primary/30 shadow-lg max-w-xs text-xs font-mono">
      <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
        <Bug className="w-4 h-4" />
        Cue Debug (Trial #{trialNumber})
      </div>
      
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">stallDetected:</span>
          <Badge variant={stallDetected ? "destructive" : "outline"} className="text-xs">
            {stallDetected ? 'true' : 'false'}
          </Badge>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">consecutiveErrors:</span>
          <Badge variant={consecutiveErrors >= 2 ? "destructive" : "outline"} className="text-xs">
            {consecutiveErrors}
          </Badge>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">autoCueShown:</span>
          <Badge variant={autoCueShownThisTrial ? "default" : "outline"} className="text-xs">
            {autoCueShownThisTrial ? 'true' : 'false'}
          </Badge>
        </div>
        
        <div className="border-t border-border my-2" />
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">cueLevel:</span>
          <span className="font-bold">{cueLevel}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">cueType:</span>
          <span className="font-bold">{cueType || 'none'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">cueTrigger:</span>
          <Badge 
            variant={cueTrigger === 'stall' ? 'default' : cueTrigger === 'consecutive_errors' ? 'destructive' : cueTrigger === 'user_request' ? 'secondary' : 'outline'} 
            className="text-xs"
          >
            {cueTrigger || 'none'}
          </Badge>
        </div>
        
        {cueShownAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">time since cue:</span>
            <span className={timeSinceCue && timeSinceCue > 6 ? 'text-amber-500' : ''}>
              {timeSinceCue}s
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
