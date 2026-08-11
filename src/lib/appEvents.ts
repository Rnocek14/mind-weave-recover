/**
 * appEvents — minimal self-hosted product analytics.
 *
 * Fire-and-forget funnel events into the `app_events` table so launch
 * questions ("how many signups reached a first session this week?") are
 * answerable without an external vendor. RLS: users insert their own rows,
 * admins read.
 *
 * Deliberately tiny: one write per event, no batching, no retries — a lost
 * funnel event is acceptable in a way lost therapy data is not. Every event
 * name lives in FUNNEL_EVENTS so the vocabulary can't drift per call site.
 *
 * Requires an authenticated user (RLS) — pre-auth landing views are not
 * captured; the funnel starts at signup_completed.
 */

import { supabase } from '@/integrations/supabase/client';

export const FUNNEL_EVENTS = {
  SIGNUP_COMPLETED: 'signup_completed',
  WELCOME_COMPLETED: 'welcome_completed',
  SCREENER_COMPLETED: 'screener_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  SESSION_STARTED: 'session_started',
  SESSION_COMPLETED: 'session_completed',
  EXERCISE_STARTED: 'exercise_started',
  // Functional Command Scenes (practice surface — outside mastery).
  SCENE_PRACTICE_STARTED: 'scene_practice_started',
  SCENE_COMMAND: 'scene_command',
} as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

const seenThisPageLoad = new Set<string>();

export function trackEvent(
  event: FunnelEvent,
  properties: Record<string, unknown> = {},
  options: { oncePerLoad?: boolean } = {}
): void {
  if (options.oncePerLoad) {
    const key = `${event}:${JSON.stringify(properties)}`;
    if (seenThisPageLoad.has(key)) return;
    seenThisPageLoad.add(key);
  }

  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('app_events' as never).insert({
        user_id: user.id,
        event,
        properties,
      } as never);
    } catch {
      // Analytics must never surface into the product experience.
    }
  })();
}
