/**
 * TrialReportControl — one tap to tell us the app got a trial wrong.
 *
 * WHY IT EXISTS: every defect that has ever mattered in this app was found by
 * a person sitting next to the person practicing. That does not scale past
 * one family. This is the substitute — and it is deliberately the smallest
 * possible version of one.
 *
 * DESIGN RULES, all of them learned the hard way:
 *   • No typing. The audience includes people whose language is impaired;
 *     "describe the problem" is the hardest thing we could ask. One tap
 *     sends a complete report, because the app already knows what was asked,
 *     what was heard, and how it scored. A note is optional and always second.
 *   • Never mid-trial, never a modal. The uninterrupted session flow is what
 *     this whole app protects; a dialog over a practice screen is a
 *     regression, not a feature.
 *   • It disappears when there is nothing to report. A button offering to
 *     report a trial the person has already forgotten is noise.
 *   • The labels name the actual defect, and which ones show depends on how
 *     the trial scored — so nobody has to translate their experience into
 *     our vocabulary.
 *
 * It never touches the TTS or microphone paths. That area is where we have
 * introduced bugs before, and a feedback button is not worth that risk.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquareWarning, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getRecentTrial, clearLastTrial, type LastTrial } from '@/lib/feedback/lastTrial';
import { submitTrialReport, attachNote, type ReportReason } from '@/lib/feedback/submitTrialReport';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'open' | 'sent' | 'noting';

/** Poll rather than subscribe: the store is written from a non-React path. */
const POLL_MS = 1500;

export function TrialReportControl() {
  const location = useLocation();
  const onExerciseRoute = location.pathname.startsWith('/exercise/');

  const [trial, setTrial] = useState<LastTrial | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reportId, setReportId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // Forget the trial when the person leaves the exercise, so a report can
  // never be attached to the wrong screen.
  useEffect(() => {
    if (!onExerciseRoute) {
      clearLastTrial();
      setTrial(null);
      setPhase('idle');
      setReportId(null);
      setNote('');
    }
  }, [onExerciseRoute]);

  useEffect(() => {
    if (!onExerciseRoute) return;
    const tick = () => setTrial(getRecentTrial());
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [onExerciseRoute]);

  const send = useCallback(
    async (reason: ReportReason) => {
      if (!trial) return;
      setPhase('sent');
      const result = await submitTrialReport(trial, reason);
      setReportId(result.id);
    },
    [trial]
  );

  const sendNote = useCallback(async () => {
    if (reportId && note.trim()) await attachNote(reportId, note);
    setPhase('sent');
    setNote('');
  }, [reportId, note]);

  // Nothing to report, or nowhere to report it.
  if (!onExerciseRoute || !trial) return null;

  // Positioned directly BELOW the pause button, in the same right-hand
  // column. Bottom-right and bottom-left are both already occupied on some
  // screens (QuickActionFAB, MayaAssistantBubble and ViewToggle all sit there
  // at higher z-index), and putting a control underneath another control is
  // exactly the defect we already fixed once when the pause button was hiding
  // behind a game header. top-[8.75rem] clears the pause button in both its
  // standard and simplified (larger) sizes.
  const wrapper = 'fixed top-[8.75rem] right-3 z-40 max-w-[min(20rem,calc(100vw-1.5rem))]';

  if (phase === 'idle') {
    return (
      <div className={wrapper}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPhase('open')}
          className="bg-background/95 backdrop-blur shadow-sm text-sm"
          aria-label="Tell us the app got that wrong"
        >
          <MessageSquareWarning className="h-4 w-4 mr-1.5" />
          Something wrong?
        </Button>
      </div>
    );
  }

  if (phase === 'open') {
    return (
      <div className={cn(wrapper, 'rounded-xl border border-border bg-background shadow-lg p-3 space-y-2')}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">What happened?</p>
          <button
            onClick={() => setPhase('idle')}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-1.5">
          {/* The offered reasons follow how the trial actually scored, so the
              person never has to translate their experience into ours. */}
          {!trial.isCorrect && (
            <Button variant="outline" size="sm" className="justify-start text-sm h-auto py-2" onClick={() => send('should_have_counted')}>
              That should have counted
            </Button>
          )}
          {trial.isCorrect && (
            <Button variant="outline" size="sm" className="justify-start text-sm h-auto py-2" onClick={() => send('should_not_have_counted')}>
              That shouldn't have counted
            </Button>
          )}
          <Button variant="outline" size="sm" className="justify-start text-sm h-auto py-2" onClick={() => send('not_heard')}>
            It didn't hear me
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">
          Sends what you said and how it was scored — nothing else.
        </p>
      </div>
    );
  }

  if (phase === 'noting') {
    return (
      <div className={cn(wrapper, 'rounded-xl border border-border bg-background shadow-lg p-3 space-y-2')}>
        <p className="text-sm font-semibold">Anything to add?</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Optional — a few words is plenty."
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={sendNote} className="text-sm">Send</Button>
          <Button size="sm" variant="ghost" onClick={() => setPhase('sent')} className="text-sm">
            Skip
          </Button>
        </div>
      </div>
    );
  }

  // phase === 'sent'
  return (
    <div className={cn(wrapper, 'rounded-xl border border-border bg-background shadow-lg p-3 space-y-2')}>
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <Check className="h-4 w-4 text-primary" /> Thank you — that's logged.
      </p>
      <p className="text-xs text-muted-foreground leading-snug">
        Reports like this are how the app gets fixed. Carry on practicing.
      </p>
      <div className="flex gap-2">
        {reportId && (
          <Button size="sm" variant="outline" onClick={() => setPhase('noting')} className="text-sm">
            Add a note
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setPhase('idle')} className="text-sm">
          Close
        </Button>
      </div>
    </div>
  );
}
