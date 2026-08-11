-- Self-hosted observability: crash reports + product funnel events.
--
-- The app previously had zero field visibility: no error tracking and no
-- product analytics of any kind. These two tables give the minimum viable
-- versions of both without an external vendor. When Sentry/PostHog are
-- added later, they supplement — the write paths stay as a fallback.

-- ── Crash / error reports ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,              -- 'render' | 'window.onerror' | 'unhandledrejection'
  message text NOT NULL,
  detail text,                       -- stack / component stack, truncated client-side
  url text,                          -- pathname where it happened
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own error reports"
  ON public.client_errors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read error reports"
  ON public.client_errors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS client_errors_created_at_idx
  ON public.client_errors (created_at DESC);

-- ── Product funnel events ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,               -- e.g. 'signup_completed', 'first_session_started'
  properties jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own events"
  ON public.app_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read events"
  ON public.app_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS app_events_event_created_idx
  ON public.app_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_user_created_idx
  ON public.app_events (user_id, created_at DESC);
