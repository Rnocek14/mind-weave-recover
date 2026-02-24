-- Add session_id column to dose_logs for dedup on speech auto-dose
ALTER TABLE public.dose_logs
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Unique constraint: one dose_log per session (prevents double-insert on session end)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dose_logs_session_id ON public.dose_logs (session_id) WHERE session_id IS NOT NULL;