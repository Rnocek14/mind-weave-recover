-- Fix storage RLS policies for secure per-user folder access
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read photos" ON storage.objects;

-- Create secure per-user folder policies
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can read their own photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' 
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' 
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' 
  AND auth.uid()::text = split_part(name, '/', 1)
);