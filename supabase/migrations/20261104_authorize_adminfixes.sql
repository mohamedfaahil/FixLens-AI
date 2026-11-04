-- ====================================================================
-- FixLens AI — Authorize adminfixes@gmail.com as Campus Administrator
-- ====================================================================
-- Description:
-- 1. Updates RLS policies on public.complaint_escalations and
--    public.maintenance_anomalies to permit authorized administrators
--    (public.is_admin() or whitelisted admin emails: adminfix@gmail.com, adminfixes@gmail.com).
-- 2. Calls public.provision_initial_admin('adminfixes@gmail.com') to:
--    a) Set auth.users raw_app_meta_data to {"role": "admin"}
--    b) Upsert public.profiles with role = 'admin'
--
-- How to apply:
-- Run this migration in the Supabase Dashboard SQL Editor, or via Supabase CLI.
-- ====================================================================

-- 1. Update RLS policies on complaint_escalations
DROP POLICY IF EXISTS "Admins can view all complaint escalations" ON public.complaint_escalations;
CREATE POLICY "Admins can view all complaint escalations"
  ON public.complaint_escalations
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR coalesce(auth.jwt()->>'email', '') IN ('adminfix@gmail.com', 'adminfixes@gmail.com')
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage complaint escalations" ON public.complaint_escalations;
CREATE POLICY "Admins can manage complaint escalations"
  ON public.complaint_escalations
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR coalesce(auth.jwt()->>'email', '') IN ('adminfix@gmail.com', 'adminfixes@gmail.com')
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- 2. Update RLS policies on maintenance_anomalies
DROP POLICY IF EXISTS "Admins can view maintenance anomalies" ON public.maintenance_anomalies;
CREATE POLICY "Admins can view maintenance anomalies"
  ON public.maintenance_anomalies
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR coalesce(auth.jwt()->>'email', '') IN ('adminfix@gmail.com', 'adminfixes@gmail.com')
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage maintenance anomalies" ON public.maintenance_anomalies;
CREATE POLICY "Admins can manage maintenance anomalies"
  ON public.maintenance_anomalies
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR coalesce(auth.jwt()->>'email', '') IN ('adminfix@gmail.com', 'adminfixes@gmail.com')
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- 3. Securely provision adminfixes@gmail.com with verified administrator role
SELECT public.provision_initial_admin('adminfixes@gmail.com');
