-- ====================================================================
-- FixLens AI — Supabase Storage Configuration & Policies
-- Target Instance: https://snwcmuptrvmpniuevofj.supabase.co
-- Bucket: complaint-images (STRICTLY PRIVATE)
-- ====================================================================
-- IMPORTANT EXECUTION NOTICE:
-- This script configures the storage bucket and Row-Level Security on storage.objects.
-- It is completely IDEMPOTENT and REPEATABLE (uses DROP POLICY IF EXISTS).
-- It modifies ONLY FixLens complaint-image policies without affecting unrelated buckets.
--
-- To execute this script on your Supabase instance:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ====================================================================

-- ====================================================================
-- 1. BUCKET INITIALIZATION
-- ====================================================================
-- Configure 'complaint-images' as a PRIVATE bucket.
-- Limit maximum file size to 5MB (5 * 1024 * 1024 = 5242880 bytes).
-- Restrict MIME types strictly to standard image formats.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-images',
  'complaint-images',
  false, -- STRICTLY PRIVATE: prevents unauthorized public internet access and scraping
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ====================================================================
-- 2. HELPER AUTHORIZATION FUNCTION
-- ====================================================================
-- Narrowly scoped SECURITY DEFINER function to check storage read authorization
-- without requiring unrestricted SELECT access to public.complaints.
-- Uses EXACT path matching (no wildcards or loose LIKE).
CREATE OR REPLACE FUNCTION public.can_access_complaint_image(object_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Unauthenticated users are denied immediately
  IF auth.role() <> 'authenticated' THEN
    RETURN FALSE;
  END IF;

  -- 2. Administrators can access all complaint images
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- 3. The uploader (folder owner matching auth.uid()) can always access their own files
  --    Path pattern: "<user_id>/<filename>"
  IF (split_part(object_path, '/', 1)) = auth.uid()::text THEN
    RETURN TRUE;
  END IF;

  -- 4. An authenticated student may access the image IF AND ONLY IF
  --    the exact object_path is attached to an authorized active campus complaint
  RETURN EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')
      AND (
        c.image_url = object_path
        OR c.image_url = ('complaint-images/' || object_path)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_complaint_image(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_complaint_image(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_complaint_image(TEXT) TO authenticated;

-- ====================================================================
-- 3. ROW-LEVEL SECURITY ON storage.objects
-- ====================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- EXPLICIT CLEANUP OF FIXLENS COMPLAINT POLICIES
-- Uses targeted DROP POLICY IF EXISTS statements for all known legacy
-- and current FixLens policy names. Does not drop unknown policies,
-- leaving unrelated buckets and application features completely untouched.
-- --------------------------------------------------------------------

-- 1. Explicitly drop all known legacy FixLens policy names from previous iterations
DROP POLICY IF EXISTS "Complaint images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update photos in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete photos in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to complaint-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view complaint images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view complaint images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload complaint images" ON storage.objects;

-- 2. Explicitly drop all four current FixLens policy names before recreating them
-- (Guarantees safe, repeatable execution on partially or previously initialized databases)
DROP POLICY IF EXISTS "Complaint images upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Complaint images select policy" ON storage.objects;
DROP POLICY IF EXISTS "Complaint images update policy" ON storage.objects;
DROP POLICY IF EXISTS "Complaint images delete policy" ON storage.objects;

-- --------------------------------------------------------------------
-- RECREATE THE 4 INTENDED COMPLAINT-IMAGES POLICIES
-- --------------------------------------------------------------------

-- 1. UPLOAD (INSERT) POLICY
-- Authenticated users can only upload files to the 'complaint-images' bucket,
-- and the object path MUST start with their own authenticated user UUID:
-- Pattern: "<auth.uid()>/<filename>"
CREATE POLICY "Complaint images upload policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. READ (SELECT) POLICY
-- Access is evaluated via public.can_access_complaint_image(name):
-- - Original uploader can view/sign their own files
-- - Administrators can view/sign any image
-- - Students can view/sign an image ONLY IF exactly attached to an active complaint
-- - Bucket is private (public = false); zero loose wildcards
CREATE POLICY "Complaint images select policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND public.can_access_complaint_image(storage.objects.name)
  );

-- 3. UPDATE POLICY
-- Only the owner of the image folder or an administrator can update or replace files.
CREATE POLICY "Complaint images update policy"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'complaint-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- 4. DELETE POLICY
-- Only the owner of the image folder or an administrator can delete images.
CREATE POLICY "Complaint images delete policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- ====================================================================
-- 4. INTEGRATION USAGE GUIDE (FOR FRONTEND CLIENT CODE)
-- ====================================================================
-- 1. Uploading an image from the frontend:
--    const filePath = `${user.id}/${Date.now()}-${file.name}`;
--    const { data, error } = await supabase.storage
--      .from('complaint-images')
--      .upload(filePath, file, { contentType: file.type });
--
-- 2. Generating a secure time-limited display URL (e.g. for complaint detail):
--    const { data, error } = await supabase.storage
--      .from('complaint-images')
--      .createSignedUrl(filePath, 3600); // URL valid for 1 hour
--    const imageUrl = data?.signedUrl;
--
-- 3. Downloading image as authenticated user or admin:
--    const { data, error } = await supabase.storage
--      .from('complaint-images')
--      .download(filePath);
-- ====================================================================

-- ====================================================================
-- 5. VERIFICATION QUERIES (RUN IN SUPABASE SQL EDITOR)
-- ====================================================================

-- VERIFICATION QUERY A: List ALL active policies on storage.objects across all buckets
-- (Use to inspect the entire database storage security posture and audit any unrelated policies)
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   cmd,
--   roles,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' 
--   AND tablename = 'objects'
-- ORDER BY policyname;

-- VERIFICATION QUERY B: List policies that explicitly reference the 'complaint-images' bucket
-- (Inspects actual bucket_id conditions in qual and with_check)
-- SELECT 
--   policyname,
--   cmd,
--   roles,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' 
--   AND tablename = 'objects'
--   AND (
--     coalesce(qual, '') ILIKE '%bucket_id%''complaint-images''%'
--     OR coalesce(with_check, '') ILIKE '%bucket_id%''complaint-images''%'
--   )
-- ORDER BY policyname;
