/**
 * Functional Command Scenes — page shell
 * (docs/functional-command-scenes-spec.md).
 *
 * Deliberately light: this is a PRACTICE surface outside the session /
 * mastery / clinical-progression machinery. Telemetry is app_events only.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { FunctionalScenePlayer, type SceneCommandEvent } from '@/components/FunctionalScenePlayer';
import { trackEvent, FUNNEL_EVENTS } from '@/lib/appEvents';
import { SCENE_PRACTICE_STAGES, type ScenePracticeLevel } from '@/lib/scenes/practiceStages';

export default function FunctionalScenesExercise() {
  const navigate = useNavigate();
  const [selectedStage, setSelectedStage] = useState<ScenePracticeLevel | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    trackEvent(FUNNEL_EVENTS.EXERCISE_STARTED, { exercise: 'functional-scenes' }, { oncePerLoad: true });
    trackEvent(FUNNEL_EVENTS.SCENE_PRACTICE_STARTED, {}, { oncePerLoad: true });
  }, []);

  const handleCommand = (e: SceneCommandEvent) => {
    trackEvent(FUNNEL_EVENTS.SCENE_COMMAND, {
      scene: e.sceneId,
      command: e.command,
      form_used: e.formUsed,
      input_mode: e.inputMode,
      changed: e.changed,
      at_limit: e.atLimit,
      practice_stage: e.practiceStage ?? null,
      step: e.step ?? null,
      support_shown: e.supportShown ?? null,
      goal_reached: e.goalReached ?? null,
      clinical_progression_eligible: false,
    });
  };

  const handleSceneChange = (sceneId: string) => {
    trackEvent(FUNNEL_EVENTS.SCENE_COMMAND, { scene: sceneId, command: '__scene_open__', input_mode: 'tap' });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex w-full max-w-lg items-center gap-2 p-4">
        <Button variant="ghost" size="icon" aria-label="Back to practice" onClick={() => navigate('/practice')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Command Scenes</h1>
          <p className="text-sm text-muted-foreground">Say a word — watch the scene respond.</p>
        </div>
      </header>
      <main className="px-4 pb-10">
        {!started ? (
          <div className="mx-auto max-w-lg space-y-3 rounded-xl border p-4">
            <h2 className="text-xl font-semibold">Practice useful commands</h2>
            <p className="text-sm text-muted-foreground">
              A care partner may choose one of eight different scene activities.
              These practice commands; they do not change the saved clinical level.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCENE_PRACTICE_STAGES.map(stage => (
                <Button key={stage.level} type="button"
                  variant={selectedStage === stage.level ? 'default' : 'outline'}
                  aria-pressed={selectedStage === stage.level}
                  className="justify-start text-left whitespace-normal h-auto min-h-14 p-3"
                  onClick={() => setSelectedStage(stage.level)}>
                  Stage {stage.level}: {stage.title}
                </Button>
              ))}
            </div>
            {selectedStage && <p className="rounded-lg bg-muted p-3 text-sm" role="status">
              {SCENE_PRACTICE_STAGES[selectedStage - 1].instruction}
            </p>}
            <Button size="lg" className="w-full min-h-14" disabled={!selectedStage}
              onClick={() => setStarted(true)}>Start scene practice</Button>
            <Button variant="ghost" className="w-full" onClick={() => setStarted(true)}>
              Use free scene practice instead
            </Button>
          </div>
        ) : (
          <FunctionalScenePlayer practiceLevel={selectedStage}
            onCommandApplied={handleCommand} onSceneChange={handleSceneChange} />
        )}
      </main>
    </div>
  );
}
