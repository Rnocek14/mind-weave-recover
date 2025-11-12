-- Enable RLS on storage.objects for photos bucket
-- Allow admins to upload, view, and delete photos

-- Policy: Admins can upload photos
CREATE POLICY "Admins can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Policy: Admins can view all photos
CREATE POLICY "Admins can view photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Policy: Admins can update photos
CREATE POLICY "Admins can update photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Policy: Admins can delete photos
CREATE POLICY "Admins can delete photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);