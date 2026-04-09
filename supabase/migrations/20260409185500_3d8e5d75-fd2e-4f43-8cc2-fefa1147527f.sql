-- Create clinician_session_notes table
CREATE TABLE public.clinician_session_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  clinician_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'observation',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinician_session_notes ENABLE ROW LEVEL SECURITY;

-- Users can view notes on their own sessions via profile
CREATE POLICY "Users view own session notes via profile"
  ON public.clinician_session_notes
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = clinician_session_notes.profile_id
    AND profiles.user_id = auth.uid()
  ));

-- Clinicians can manage notes on assigned patients
CREATE POLICY "Clinicians manage assigned session notes"
  ON public.clinician_session_notes
  FOR ALL
  TO authenticated
  USING (is_assigned_clinician(auth.uid(), profile_id))
  WITH CHECK (is_assigned_clinician(auth.uid(), profile_id));

-- Users can manage their own notes (self-clinician / admin)
CREATE POLICY "Users manage own clinician notes"
  ON public.clinician_session_notes
  FOR ALL
  USING (auth.uid() = clinician_id)
  WITH CHECK (auth.uid() = clinician_id);

-- Admins can manage all
CREATE POLICY "Admins manage all session notes"
  ON public.clinician_session_notes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_clinician_session_notes_updated_at
  BEFORE UPDATE ON public.clinician_session_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_clinician_session_notes_session ON public.clinician_session_notes(session_id);
CREATE INDEX idx_clinician_session_notes_profile ON public.clinician_session_notes(profile_id);