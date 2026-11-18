import { voiceController } from './voiceController';

/** Run an exercise timer on active practice time. The returned function cancels it. */
export function scheduleSessionTimer(callback: () => void, delayMs: number, repeat = false): () => void {
  let deadline = voiceController.activeTimeMs + delayMs;
  let timer: ReturnType<typeof setTimeout>;
  let cancelled = false;

  function arm() {
    if (cancelled || voiceController.isSessionPaused) return;
    timer = setTimeout(() => {
      if (!repeat) cancel();
      else deadline = voiceController.activeTimeMs + delayMs;
      callback();
      if (repeat) arm();
    }, Math.max(0, deadline - voiceController.activeTimeMs));
  }

  const unsubscribe = voiceController.subscribeSessionPaused(paused => {
    clearTimeout(timer);
    if (!paused) arm();
  });
  function cancel() {
    cancelled = true;
    clearTimeout(timer);
    unsubscribe();
  }
  arm();
  return cancel;
}
