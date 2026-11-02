-- ====================================================================
-- FIXLENS AI — PHASE 2 DATABASE MIGRATION
-- PRIORITY ESCALATION, MAINTENANCE ANOMALIES & DYNAMIC ADMIN ALERTS
-- ====================================================================

-- 1. COMPLAINT ESCALATIONS AUDIT TRAIL
-- Stores history of every automated and manual priority escalation
CREATE TABLE IF NOT EXISTS public.complaint_escalations (
  id TEXT PRIMARY KEY DEFAULT ('ESC-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::int),
  complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  previous_priority TEXT NOT NULL CHECK (previous_priority IN ('Low', 'Medium', 'High')),
  escalated_priority TEXT NOT NULL CHECK (escalated_priority IN ('Low', 'Medium', 'High')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. MAINTENANCE ANOMALIES TABLE
-- Stores spatial and category maintenance anomalies, hotspots and surges
CREATE TABLE IF NOT EXISTS public.maintenance_anomalies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('BUILDING_SPIKE', 'ROOM_HOTSPOT', 'CATEGORY_SURGE', 'UNRESOLVED_BACKLOG', 'MULTI_STUDENT_HAZARD')),
  severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),
  building TEXT NOT NULL,
  room TEXT,
  category TEXT,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  contributing_complaint_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  distinct_reporters INTEGER NOT NULL DEFAULT 1,
  incident_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Investigating', 'Acknowledged', 'Resolved')),
  admin_notes TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. EXTEND COMPLAINTS TABLE (BACKWARDS COMPATIBLE)
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS escalated_priority TEXT CHECK (escalated_priority IN ('Low', 'Medium', 'High'));
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS escalation_reasons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_admin_override BOOLEAN DEFAULT false;

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_complaint_escalations_complaint_id ON public.complaint_escalations(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_escalations_created_at ON public.complaint_escalations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_anomalies_building ON public.maintenance_anomalies(building);
CREATE INDEX IF NOT EXISTS idx_maintenance_anomalies_status ON public.maintenance_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_anomalies_detected_at ON public.maintenance_anomalies(detected_at DESC);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.complaint_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_anomalies ENABLE ROW LEVEL SECURITY;

-- Administrators can read all escalations
DROP POLICY IF EXISTS "Admins can view all complaint escalations" ON public.complaint_escalations;
CREATE POLICY "Admins can view all complaint escalations"
  ON public.complaint_escalations
  FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt()->>'email', '') = 'adminfix@gmail.com'
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Administrators can insert or update escalations
DROP POLICY IF EXISTS "Admins can manage complaint escalations" ON public.complaint_escalations;
CREATE POLICY "Admins can manage complaint escalations"
  ON public.complaint_escalations
  FOR ALL
  TO authenticated
  USING (
    coalesce(auth.jwt()->>'email', '') = 'adminfix@gmail.com'
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Administrators can view all maintenance anomalies
DROP POLICY IF EXISTS "Admins can view maintenance anomalies" ON public.maintenance_anomalies;
CREATE POLICY "Admins can view maintenance anomalies"
  ON public.maintenance_anomalies
  FOR SELECT
  TO authenticated
  USING (
    coalesce(auth.jwt()->>'email', '') = 'adminfix@gmail.com'
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Administrators can manage (update/insert) maintenance anomalies
DROP POLICY IF EXISTS "Admins can manage maintenance anomalies" ON public.maintenance_anomalies;
CREATE POLICY "Admins can manage maintenance anomalies"
  ON public.maintenance_anomalies
  FOR ALL
  TO authenticated
  USING (
    coalesce(auth.jwt()->>'email', '') = 'adminfix@gmail.com'
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
