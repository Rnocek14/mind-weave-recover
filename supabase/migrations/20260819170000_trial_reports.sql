-- One-tap "the app got that wrong" reports from inside a practice session.
--
-- WHY: every defect that has ever mattered in this app was found by a person
-- sitting next to the person practicing. That does not scale past one family.
-- This is the replacement for that channel.
--
-- The column that makes it useful is `signature`. A report button is easy; a
-- report INBOX is the thing that fails, because forty people hitting one bug
-- produce forty rows, the real signal drowns in duplicates, and within a
-- month nobody reads the table. The signature is a stable grouping key
-- computed client-side from the exercise, the item, what was heard and how it
-- scored — so the same bug collapses into one row with a count, which is also
-- a priority ranking. See src/lib/feedback/reportSignature.ts.

CREATE TABLE IF NOT EXISTS public.trial_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Defaulted so the client never has to send it and can never send someone
  -- else's; the RLS check below still enforces it.
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What the person is telling us. Three codes because they lead to three
  -- different fixes: a matcher change, a scorer change, or a microphone /
  -- recognition problem.
  reason text NOT NULL CHECK (reason IN ('should_have_counted', 'should_not_have_counted', 'not_heard')),

  -- Grouping key + a one-line human summary, so a triage list is readable
  -- without joining anything.
  signature text NOT NULL,
  headline text NOT NULL,

  -- Enough context to reproduce the defect without contacting the reporter.
  exercise_slug text NOT NULL,
  session_id uuid,
  level integer,
  trial_index integer,
  stimulus_id text,
  expected_response text,
  user_response text,
  browser_transcript text,
  scored_correct boolean NOT NULL,
  cue_level integer,

  -- Always optional, always second. Asking someone with impaired language to
  -- describe a problem in writing is the hardest thing we could request.
  note text,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own trial reports"
  ON public.trial_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- The client reads back only the id it just wrote, so it can attach a note.
CREATE POLICY "Users read their own trial reports"
  ON public.trial_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Notes arrive after the report, as a second optional step.
CREATE POLICY "Users update their own trial reports"
  ON public.trial_reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read trial reports"
  ON public.trial_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS trial_reports_signature_idx
  ON public.trial_reports (signature);

CREATE INDEX IF NOT EXISTS trial_reports_created_at_idx
  ON public.trial_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS trial_reports_exercise_idx
  ON public.trial_reports (exercise_slug, created_at DESC);

-- ── Triage ────────────────────────────────────────────────────────────
-- The only query needed to run this feature. Most-reported defect first;
-- each row is one bug, not one complaint.
--
--   SELECT signature,
--          count(*)                          AS reports,
--          count(DISTINCT user_id)           AS people,
--          min(headline)                     AS what_happened,
--          max(created_at)                   AS last_seen,
--          array_agg(DISTINCT note) FILTER (WHERE note IS NOT NULL) AS notes
--   FROM public.trial_reports
--   WHERE created_at > now() - interval '30 days'
--   GROUP BY signature
--   ORDER BY reports DESC, last_seen DESC
--   LIMIT 25;
