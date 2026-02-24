
-- Dedicated table for caregiver context notes (not sessions)
CREATE TABLE public.caregiver_context_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.caregiver_context_notes ENABLE ROW LEVEL SECURITY;

-- Users can manage their own notes via profile
CREATE POLICY "Users manage own caregiver notes via profile"
  ON public.caregiver_context_notes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = caregiver_context_notes.profile_id
      AND profiles.user_id = auth.uid()
  ));
