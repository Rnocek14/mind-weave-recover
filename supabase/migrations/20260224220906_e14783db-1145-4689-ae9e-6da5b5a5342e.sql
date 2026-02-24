
-- Add performance index for clinician "patient context" panel
CREATE INDEX idx_caregiver_context_notes_profile_date 
  ON public.caregiver_context_notes (profile_id, created_at DESC);

-- Add audit index
CREATE INDEX idx_caregiver_context_notes_user_date 
  ON public.caregiver_context_notes (user_id, created_at DESC);
