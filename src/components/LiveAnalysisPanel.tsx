/**
 * Live Analysis Panel
 * 
 * Right-side slide-out panel showing real-time speech analysis,
 * adaptation decisions, and engine state. Three view modes gated by uiMode.
 * 
 * Toggle: floating button on right edge, visible when uiMode >= caregiver OR ?debug=live
 */

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, X } from 'lucide-react';
import { useLiveAnalysis } from '@/contexts/LiveAnalysisContext';
import { useUiMode } from '@/hooks/useUiMode';
import { LiveInputCard } from '@/components/live-analysis/LiveInputCard';
import { SpeechAnalysisCard } from '@/components/live-analysis/SpeechAnalysisCard';
import { AdaptationCard } from '@/components/live-analysis/AdaptationCard';
import { SessionStateCard } from '@/components/live-analysis/SessionStateCard';
import { AuditTrailCard } from '@/components/live-analysis/AuditTrailCard';
import { DecisionChainCard } from '@/components/live-analysis/DecisionChainCard';

type PanelMode = 'patient' | 'clinician' | 'demo';

function mapUiModeToPanel(uiMode: string): PanelMode {
  if (uiMode === 'patient') return 'patient';
  if (uiMode === 'admin') return 'demo';
  return 'clinician';
}

function formatFreshness(updatedAt?: number): { label: string; stale: boolean } {
  if (!updatedAt) return { label: 'No data', stale: true };
  const age = Date.now() - updatedAt;
  if (age < 3000) return { label: 'Live', stale: false };
  if (age < 10000) return { label: `${Math.round(age / 1000)}s ago`, stale: false };
  return { label: `${Math.round(age / 1000)}s ago`, stale: true };
}

export function LiveAnalysisPanel() {
  const { snapshot, auditEvents, decisionChain, isOpen, setIsOpen } = useLiveAnalysis();
  const { uiMode, isAtLeast } = useUiMode();

  // Check if debug=live in URL
  const [debugEnabled] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'live';
  });

  // Only show toggle when caregiver+ OR debug param
  const canShow = isAtLeast('caregiver') || debugEnabled;

  // Auto-select panel mode from uiMode, allow override
  const defaultMode = mapUiModeToPanel(uiMode);
  const [panelMode, setPanelMode] = useState<PanelMode>(defaultMode);

  // Sync default mode when uiMode changes
  useEffect(() => {
    setPanelMode(mapUiModeToPanel(uiMode));
  }, [uiMode]);

  const freshness = formatFreshness(snapshot.updatedAt);

  if (!canShow) return null;

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground rounded-l-lg px-2 py-3 shadow-lg hover:px-3 transition-all group"
          aria-label="Open live analysis panel"
        >
          <Activity className="h-4 w-4 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Panel sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Live Analysis
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${freshness.stale ? 'border-destructive text-destructive' : 'border-success text-success'}`}
                >
                  {freshness.label}
                </Badge>
              </SheetTitle>
            </div>

            {/* Mode tabs */}
            <Tabs value={panelMode} onValueChange={(v) => setPanelMode(v as PanelMode)} className="mt-2">
              <TabsList className="h-7 w-full">
                <TabsTrigger value="patient" className="text-[11px] h-6 flex-1">Patient</TabsTrigger>
                <TabsTrigger value="clinician" className="text-[11px] h-6 flex-1">Clinical</TabsTrigger>
                <TabsTrigger value="demo" className="text-[11px] h-6 flex-1">Demo</TabsTrigger>
              </TabsList>
            </Tabs>
          </SheetHeader>

          {/* Scrollable content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3 space-y-4">
              {/* Decision Chain - demo/clinician gold card */}
              {decisionChain && panelMode !== 'patient' && (
                <DecisionChainCard chain={decisionChain} mode={panelMode} />
              )}

              {/* Live Input */}
              <LiveInputCard snapshot={snapshot} mode={panelMode} />

              {/* Divider */}
              <div className="border-t" />

              {/* Speech Analysis */}
              <SpeechAnalysisCard snapshot={snapshot} mode={panelMode} />

              {/* Divider */}
              <div className="border-t" />

              {/* Adaptation Engine */}
              <AdaptationCard snapshot={snapshot} mode={panelMode} />

              {/* Divider */}
              <div className="border-t" />

              {/* Session State */}
              <SessionStateCard snapshot={snapshot} mode={panelMode} />

              {/* Divider */}
              {panelMode !== 'patient' && <div className="border-t" />}

              {/* Audit Trail */}
              <AuditTrailCard events={auditEvents} mode={panelMode} />

              {/* Exercise/Session ID - clinician only */}
              {panelMode === 'clinician' && (snapshot.exerciseSlug || snapshot.sessionId) && (
                <>
                  <div className="border-t" />
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {snapshot.exerciseSlug && <p>Exercise: {snapshot.exerciseSlug}</p>}
                    {snapshot.sessionId && <p>Session: {snapshot.sessionId.slice(0, 8)}…</p>}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
