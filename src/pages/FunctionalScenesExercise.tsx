/**
 * Functional Command Scenes — page shell
 * (docs/functional-command-scenes-spec.md).
 *
 * Deliberately light: this is a PRACTICE surface outside the session /
 * mastery / clinical-progression machinery. Telemetry is app_events only.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { FunctionalScenePlayer, type SceneCommandEvent } from '@/components/FunctionalScenePlayer';
import { trackEvent, FUNNEL_EVENTS } from '@/lib/appEvents';

export default function FunctionalScenesExercise() {
  const navigate = useNavigate();

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
        <FunctionalScenePlayer onCommandApplied={handleCommand} onSceneChange={handleSceneChange} />
      </main>
    </div>
  );
}
