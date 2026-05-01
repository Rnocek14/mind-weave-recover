/**
 * VoiceGateHud — floating dev overlay for live mic/gate state.
 *
 * Renders ONLY in dev or when `?hud=1` is in the URL. Subscribes to the
 * VoiceController and listens to a `gate-decision` window event so games
 * can broadcast every gate result without coupling.
 */

import React, { useEffect, useState } from 'react';
import { voiceController } from '@/lib/voiceController';
import type { GateResult } from '@/lib/evaluation/gateResponse';
import { cn } from '@/lib/utils';

interface GateDecisionEvent extends CustomEvent<{
  source: string;
  result: GateResult;
  transcript: string;
  ts: number;
}> {}

declare global {
  interface WindowEventMap {
    'voice-gate-decision': GateDecisionEvent;
  }
}

/** Games call this after every gate decision so the HUD can show it. */
export function broadcastGateDecision(source: string, result: GateResult, transcript: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('voice-gate-decision', {
    detail: { source, result, transcript, ts: Date.now() },
  }));
}

function shouldShowHud(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  return new URLSearchParams(window.location.search).get('hud') === '1';
}

export function VoiceGateHud() {
  const [show] = useState(shouldShowHud);
  const [isSpeaking, setIsSpeaking] = useState(voiceController.isSpeaking);
  const [isMicLocked, setIsMicLocked] = useState(voiceController.isMicLocked);
  const [last, setLast] = useState<GateDecisionEvent['detail'] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!show) return;
    const unsub = voiceController.subscribe(() => {
      setIsSpeaking(voiceController.isSpeaking);
      setIsMicLocked(voiceController.isMicLocked);
    });
    // Poll mic-lock so the 400ms tail-lock countdown is visible
    const t = setInterval(() => setIsMicLocked(voiceController.isMicLocked), 100);
    const onGate = (e: GateDecisionEvent) => setLast(e.detail);
    window.addEventListener('voice-gate-decision', onGate);
    return () => { unsub(); clearInterval(t); window.removeEventListener('voice-gate-decision', onGate); };
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] font-mono text-[11px] leading-tight pointer-events-auto">
      <div className="bg-black/85 text-white rounded-lg shadow-xl border border-white/10 max-w-[320px]">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 border-b border-white/10"
        >
          <span className="font-semibold">Voice/Gate HUD</span>
          <div className="flex items-center gap-1.5">
            <span className={cn('inline-block w-2 h-2 rounded-full', isSpeaking ? 'bg-amber-400 animate-pulse' : 'bg-white/20')} title="isSpeaking" />
            <span className={cn('inline-block w-2 h-2 rounded-full', isMicLocked ? 'bg-red-400' : 'bg-green-400')} title="isMicLocked" />
            <span className="text-white/50">{collapsed ? '▴' : '▾'}</span>
          </div>
        </button>

        {!collapsed && (
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-white/60">isSpeaking</span>
              <span className={cn(isSpeaking && 'text-amber-300')}>{String(isSpeaking)}</span>
              <span className="text-white/60">isMicLocked</span>
              <span className={cn(isMicLocked ? 'text-red-300' : 'text-green-300')}>{String(isMicLocked)}</span>
            </div>

            <div className="pt-2 border-t border-white/10">
              <div className="text-white/50 mb-1">Last gate decision</div>
              {!last ? (
                <div className="text-white/40 italic">— none yet —</div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-bold',
                      last.result.ok ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'
                    )}>
                      {last.result.ok ? 'PASS' : 'REJECT'}
                    </span>
                    <span className="text-white/60">{last.source}</span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0">
                    <span className="text-white/50">classification</span><span>{last.result.classification}</span>
                    <span className="text-white/50">rejectionReason</span><span>{last.result.rejectionReason ?? '—'}</span>
                    <span className="text-white/50">echoScore</span><span>{last.result.echoScore.toFixed(2)}</span>
                    <span className="text-white/50">echoMatched</span><span className="truncate" title={last.result.echoMatched ?? ''}>{last.result.echoMatched ?? '—'}</span>
                    {last.result.coachingText && (
                      <>
                        <span className="text-white/50">coaching</span>
                        <span className="text-white/90 italic">"{last.result.coachingText}"</span>
                      </>
                    )}
                  </div>
                  <div className="text-white/40 text-[10px]">transcript: "{last.transcript.slice(0, 60)}{last.transcript.length > 60 ? '…' : ''}"</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
