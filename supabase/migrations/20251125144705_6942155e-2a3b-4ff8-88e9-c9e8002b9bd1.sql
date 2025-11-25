-- Create storage bucket for session recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-recordings',
  'session-recordings',
  false,
  10485760, -- 10MB per file
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav']
);

-- Storage policies for session recordings
CREATE POLICY "Users can upload their own recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'session-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'session-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'session-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add audio recording columns to exercise_events
ALTER TABLE exercise_events
ADD COLUMN IF NOT EXISTS audio_storage_path text,
ADD COLUMN IF NOT EXISTS recording_duration_ms integer,
ADD COLUMN IF NOT EXISTS audio_mime_type text;