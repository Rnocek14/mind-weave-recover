/**
 * Clinician Strategy Controls — override, lock, or confirm therapy strategies.
 * 
 * Surfaces from the Weekly Review. Clinician choices override system selection.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, Lock, CheckCircle, AlertTriangle, Brain, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StrategyId, TherapyStrategy } from "@/lib/therapyStrategyEngine";
import type { ClinicianStrategyOverride } from "@/lib/strategyEnforcement";

interface ClinicianStrategyControlsProps {
  profileId: string;
  userId: string;
  clinicianId: string;
  currentStrategy: TherapyStrategy;
  onOverrideApplied?: () => void;
}

const STRATEGY_OPTIONS: { id: StrategyId; label: string; description: string }[] = [
  { id: 'semantic_retrieval_support', label: 'Semantic Retrieval', description: 'Word-finding through meaning connections' },
  { id: 'phonological_training', label: 'Phonological Training', description: 'Sound discrimination and phoneme contrast' },
  { id: 'spaced_reinforcement', label: 'Spaced Reinforcement', description: 'Consolidate gains and revisit targets' },
  { id: 'confidence_building', label: 'Confidence Building', description: 'Low-pressure, high-success practice' },
  { id: 'fluency_promotion', label: 'Fluency Promotion', description: 'Push retrieval speed with solid accuracy' },
  { id: 'balanced_maintenance', label: 'Balanced Maintenance', description: 'Observe and maintain across domains' },
];

export function ClinicianStrategyControls({
  profileId,
  userId,
  clinicianId,
  currentStrategy,
  onOverrideApplied,
}: ClinicianStrategyControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Override state
  const [lockStrategy, setLockStrategy] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>(currentStrategy.id);
  const [cueAggressiveness, setCueAggressiveness] = useState<'early' | 'standard' | 'delayed'>(
    currentStrategy.cueApproach.aggressiveness
  );
  const [difficultyOverride, setDifficultyOverride] = useState<'easier' | 'same' | 'harder'>(
    currentStrategy.difficultyBias
  );
  const [maxExercises, setMaxExercises] = useState(currentStrategy.pacing.maxExercisesPerSession);
  const [reason, setReason] = useState('');

  const hasChanges = 
    lockStrategy ||
    selectedStrategy !== currentStrategy.id ||
    cueAggressiveness !== currentStrategy.cueApproach.aggressiveness ||
    difficultyOverride !== currentStrategy.difficultyBias ||
    maxExercises !== currentStrategy.pacing.maxExercisesPerSession;

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);

    try {
      const override: ClinicianStrategyOverride = {};
      
      if (lockStrategy || selectedStrategy !== currentStrategy.id) {
        override.lockedStrategyId = selectedStrategy;
      }
      if (cueAggressiveness !== currentStrategy.cueApproach.aggressiveness) {
        override.cueAggressiveness = cueAggressiveness;
      }
      if (difficultyOverride !== currentStrategy.difficultyBias) {
        override.difficultyOverride = difficultyOverride;
      }
      if (maxExercises !== currentStrategy.pacing.maxExercisesPerSession) {
        override.maxExercisesOverride = maxExercises;
      }

      // Save as clinician override
      const { error } = await (supabase as any)
        .from('clinician_overrides')
        .insert({
          profile_id: profileId,
          user_id: userId,
          clinician_id: clinicianId,
          override_type: 'therapy_strategy',
          target_slug: selectedStrategy,
          value_before: {
            strategy: currentStrategy.id,
            cue: currentStrategy.cueApproach.aggressiveness,
            difficulty: currentStrategy.difficultyBias,
            maxExercises: currentStrategy.pacing.maxExercisesPerSession,
          },
          value_after: override,
          reason: reason || `Strategy override: ${selectedStrategy}`,
          status: 'active',
        });

      if (error) throw error;

      toast.success('Strategy override saved', {
        description: `Locked to ${STRATEGY_OPTIONS.find(s => s.id === selectedStrategy)?.label}`,
      });
      onOverrideApplied?.();
    } catch (err) {
      console.error('[strategy-controls] save error:', err);
      toast.error('Failed to save override');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async () => {
    toast.success('Strategy confirmed', {
      description: `${currentStrategy.label} — system will continue this approach`,
    });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Strategy Controls
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-600"
              onClick={handleConfirm}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Override'}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Current strategy summary (always visible) */}
      <CardContent className="pb-3 pt-0">
        <div className="flex items-center gap-2 text-sm">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">{currentStrategy.label}</span>
          <Badge variant="secondary" className="text-xs">
            {currentStrategy.confidence}
          </Badge>
          {lockStrategy && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
              <Lock className="w-2.5 h-2.5 mr-0.5" />
              Locked
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{currentStrategy.sessionGoal}</p>

        {/* Expanded controls */}
        {isExpanded && (
          <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
            {/* Strategy selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Therapy Strategy</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Lock</Label>
                  <Switch
                    checked={lockStrategy}
                    onCheckedChange={setLockStrategy}
                    className="scale-75"
                  />
                </div>
              </div>
              <Select
                value={selectedStrategy}
                onValueChange={(v) => setSelectedStrategy(v as StrategyId)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map(opt => (
                    <SelectItem key={opt.id} value={opt.id} className="text-xs">
                      <div>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-muted-foreground ml-2">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockStrategy && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Shield className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>System will use this strategy until unlocked, ignoring auto-selection.</span>
                </div>
              )}
            </div>

            {/* Cue aggressiveness */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Cue Timing</Label>
              <Select
                value={cueAggressiveness}
                onValueChange={(v) => setCueAggressiveness(v as any)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="early" className="text-xs">Early — cue sooner to prevent frustration</SelectItem>
                  <SelectItem value="standard" className="text-xs">Standard — balanced timing</SelectItem>
                  <SelectItem value="delayed" className="text-xs">Delayed — wait longer for self-retrieval</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty bias */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Difficulty Bias</Label>
              <Select
                value={difficultyOverride}
                onValueChange={(v) => setDifficultyOverride(v as any)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easier" className="text-xs">Easier — prioritize success</SelectItem>
                  <SelectItem value="same" className="text-xs">Same — match current level</SelectItem>
                  <SelectItem value="harder" className="text-xs">Harder — push boundaries</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max exercises */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Max Exercises per Session</Label>
                <span className="text-xs font-mono text-muted-foreground">{maxExercises}</span>
              </div>
              <Slider
                value={[maxExercises]}
                onValueChange={([v]) => setMaxExercises(v)}
                min={2}
                max={12}
                step={1}
                className="py-1"
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Clinical Rationale (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Patient reported fatigue last session..."
                className="text-xs min-h-[60px] resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {hasChanges && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Unsaved changes</span>
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIsExpanded(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!hasChanges || isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? 'Saving...' : 'Apply Override'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
