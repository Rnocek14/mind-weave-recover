/**
 * MicFailureRecovery — Persistent mic failure UI for Full Coaching mode.
 * 
 * Replaces disappearing toasts with a sticky, actionable recovery panel.
 * Shows when mic permission is denied or recording fails.
 */

import React from 'react';
import { AlertCircle, Mic, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MicFailureRecoveryProps {
  /** Whether the failure state is active */
  visible: boolean;
  /** Retry mic permission / start listening again */
  onRetry: () => void;
  /** Switch to typing mode */
  onSwitchToTyping?: () => void;
  /** Optional: custom message */
  message?: string;
  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

export function MicFailureRecovery({
  visible,
  onRetry,
  onSwitchToTyping,
  message = "Microphone unavailable",
  compact = false,
  className,
}: MicFailureRecoveryProps) {
  if (!visible) return null;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm animate-in fade-in duration-300",
        className
      )}>
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-destructive font-medium">{message}</span>
        <Button variant="outline" size="sm" onClick={onRetry} className="ml-auto h-7 text-xs">
          <Mic className="h-3 w-3 mr-1" />
          Retry
        </Button>
        {onSwitchToTyping && (
          <Button variant="ghost" size="sm" onClick={onSwitchToTyping} className="h-7 text-xs">
            <Keyboard className="h-3 w-3 mr-1" />
            Type
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl bg-destructive/5 border-2 border-destructive/20 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
      className
    )}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-destructive" />
        </div>
        <div>
          <p className="font-medium text-sm text-foreground">{message}</p>
          <p className="text-xs text-muted-foreground">
            Check your microphone permissions and try again.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} className="flex-1">
          <Mic className="h-4 w-4 mr-1" />
          Try microphone again
        </Button>
        {onSwitchToTyping && (
          <Button variant="ghost" size="sm" onClick={onSwitchToTyping} className="flex-1">
            <Keyboard className="h-4 w-4 mr-1" />
            Switch to typing
          </Button>
        )}
      </div>
    </div>
  );
}
