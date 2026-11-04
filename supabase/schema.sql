-- ====================================================================
-- FixLens AI — Production Supabase Schema & Row-Level Security (RLS)
-- Target Instance: https://snwcmuptrvmpniuevofj.supabase.co
-- ====================================================================
-- IMPORTANT EXECUTION NOTICE:
-- This script is completely IDEMPOTENT and REPEATABLE. It uses
-- `DROP POLICY IF EXISTS ...; CREATE POLICY ...` and `CREATE TABLE IF NOT EXISTS`.
-- It will NEVER drop existing application tables or wipe stored records.
--
-- To execute this script on your Supabase instance:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ====================================================================

-- ====================================================================
-- 1. EXTENSIONS
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. TABLE DEFINITIONS
-- ====================================================================

-- PROFILES (User metadata linked directly to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'staff')),
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure phone column exists if table was created in an earlier migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

-- COMPLAINTS (Campus maintenance complaint tickets)
CREATE TABLE IF NOT EXISTS public.complaints (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Electrical', 'Plumbing', 'Cleaning', 'Internet/Wi-Fi', 'Furniture', 'Safety', 'Other')),
  building TEXT NOT NULL,
  room TEXT,
  urgency TEXT NOT NULL CHECK (urgency IN ('Low', 'Medium', 'High')),
  affected INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  predicted_priority TEXT CHECK (predicted_priority IN ('Low', 'Medium', 'High')),
  confidence NUMERIC(4, 3),
  prediction_source TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected')),
  reporter TEXT NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url TEXT,
  resolution_note TEXT,
  linked_complaint_id TEXT REFERENCES public.complaints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- COMPLAINT FOLLOW-UPS (Appended messages from student without duplicating complaints)
CREATE TABLE IF NOT EXISTS public.complaint_follow_ups (
  id TEXT PRIMARY KEY DEFAULT ('FU-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::int),
  complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- COMPLAINT TIMELINE (Status history and administrative transitions)
CREATE TABLE IF NOT EXISTS public.complaint_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PROPOSALS (Student-led campus improvement proposals)
CREATE TABLE IF NOT EXISTS public.proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Under Review' CHECK (status IN ('Under Review', 'Approved', 'Planned', 'Rejected')),
  author TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  support_count INTEGER NOT NULL DEFAULT 1,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PROPOSAL VOTES (Student support votes; strictly 1 vote per student per proposal)
CREATE TABLE IF NOT EXISTS public.proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id TEXT NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_user_proposal_vote UNIQUE(proposal_id, user_id)
);

-- NOTIFICATIONS (In-app notifications for students and administrator alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'status_update', 'duplicate_alert', 'proposal', 'admin_alert', 'anomaly')),
  reference_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PHASE 2: COMPLAINT ESCALATIONS AUDIT TRAIL
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

-- PHASE 2: MAINTENANCE ANOMALIES TABLE
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

-- ====================================================================
-- 3. INDEXES FOR PERFORMANCE & INTEGRITY
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_complaints_reporter_id ON public.complaints(reporter_id);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints(building, room, category);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_linked ON public.complaints(linked_complaint_id);

CREATE INDEX IF NOT EXISTS idx_follow_ups_complaint_id ON public.complaint_follow_ups(complaint_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_author_id ON public.complaint_follow_ups(author_id);

CREATE INDEX IF NOT EXISTS idx_timeline_complaint_id ON public.complaint_timeline(complaint_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON public.complaint_timeline(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_proposals_author_id ON public.proposals(author_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);

CREATE INDEX IF NOT EXISTS idx_votes_proposal_user ON public.proposal_votes(proposal_id, user_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.proposal_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ====================================================================
-- 4. TRUSTED ROLE HELPER FUNCTIONS
-- ====================================================================

-- Checks if the caller has a verified administrative role.
-- Security Safeguard: Does NOT grant admin based merely on unverified email input.
-- Validates against server-assigned JWT app_metadata or the verified database profiles record.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Direct database administration context (Supabase SQL Editor / migrations run as postgres/supabase_admin with no JWT)
  IF session_user IN ('postgres', 'supabase_admin') AND auth.role() IS NULL THEN
    RETURN TRUE;
  END IF;

  -- 2. Authenticated user with server-assigned 'admin' role in JWT app_metadata
  IF coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- 3. Authenticated user with verified database profile role = 'admin'
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;

-- ====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- A. PROFILES POLICIES
-- --------------------------------------------------------------------
-- Privacy Protection: Students can ONLY SELECT their own profile record (email, phone, etc.).
-- Other students cannot browse private contact information.
DROP POLICY IF EXISTS "Profiles select authorization" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles select authorization"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Profiles can only be inserted by self matching auth uid" ON public.profiles;
CREATE POLICY "Profiles can only be inserted by self matching auth uid"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND (role = 'student' OR public.is_admin())
  );

DROP POLICY IF EXISTS "Users can update own details but cannot self-promote role" ON public.profiles;
CREATE POLICY "Users can update own details but cannot self-promote role"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Profiles can only be deleted by admin" ON public.profiles;
CREATE POLICY "Profiles can only be deleted by admin"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- B. COMPLAINTS POLICIES
-- --------------------------------------------------------------------
-- Direct Table SELECT Authorization:
-- ONLY the complaint reporter or administrators can directly query `public.complaints`.
-- Campus-wide duplicate detection uses the privacy-preserving `public.shared_complaints` view/RPC.
DROP POLICY IF EXISTS "Complaints select authorization" ON public.complaints;
DROP POLICY IF EXISTS "Complaints are viewable by authenticated campus users" ON public.complaints;
CREATE POLICY "Complaints select authorization"
  ON public.complaints FOR SELECT
  USING (
    auth.uid() = reporter_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Authenticated users can submit complaints" ON public.complaints;
CREATE POLICY "Authenticated users can submit complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (reporter_id = auth.uid() OR public.is_admin())
  );

-- Students can ONLY update their own complaint while in 'Submitted' status;
-- cannot alter priority, status, or administrative notes.
DROP POLICY IF EXISTS "Complaint update authorization" ON public.complaints;
CREATE POLICY "Complaint update authorization"
  ON public.complaints FOR UPDATE
  USING (
    public.is_admin()
    OR (
      auth.uid() = reporter_id
      AND status = 'Submitted'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = reporter_id
      AND status = 'Submitted'
      AND priority = (SELECT c.priority FROM public.complaints c WHERE c.id = complaints.id)
    )
  );

DROP POLICY IF EXISTS "Only admins can delete complaints" ON public.complaints;
CREATE POLICY "Only admins can delete complaints"
  ON public.complaints FOR DELETE
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- C. COMPLAINT FOLLOW-UPS POLICIES
-- --------------------------------------------------------------------
-- Follow-ups can only be viewed by the author, complaint owner, or admin.
DROP POLICY IF EXISTS "Follow-ups select authorization" ON public.complaint_follow_ups;
DROP POLICY IF EXISTS "Follow-ups are viewable by authenticated users" ON public.complaint_follow_ups;
CREATE POLICY "Follow-ups select authorization"
  ON public.complaint_follow_ups FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_follow_ups.complaint_id
      AND c.reporter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated authors can append follow-ups" ON public.complaint_follow_ups;
CREATE POLICY "Authenticated authors can append follow-ups"
  ON public.complaint_follow_ups FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (author_id = auth.uid() OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_follow_ups.complaint_id
      AND (c.reporter_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Follow-ups cannot be modified by students" ON public.complaint_follow_ups;
CREATE POLICY "Follow-ups cannot be modified by students"
  ON public.complaint_follow_ups FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Follow-ups can only be deleted by admins" ON public.complaint_follow_ups;
CREATE POLICY "Follow-ups can only be deleted by admins"
  ON public.complaint_follow_ups FOR DELETE
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- D. COMPLAINT TIMELINE POLICIES
-- --------------------------------------------------------------------
-- Timeline events are viewable by the complaint reporter or administrators
DROP POLICY IF EXISTS "Timeline select authorization" ON public.complaint_timeline;
DROP POLICY IF EXISTS "Timeline events are viewable by authenticated users" ON public.complaint_timeline;
CREATE POLICY "Timeline select authorization"
  ON public.complaint_timeline FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_timeline.complaint_id
      AND c.reporter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Timeline entry authorization" ON public.complaint_timeline;
CREATE POLICY "Timeline entry authorization"
  ON public.complaint_timeline FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      auth.role() = 'authenticated'
      AND status = 'Submitted'
      AND EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_id AND c.reporter_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Timeline is immutable for students" ON public.complaint_timeline;
CREATE POLICY "Timeline is immutable for students"
  ON public.complaint_timeline FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Timeline events can only be deleted by admins" ON public.complaint_timeline;
CREATE POLICY "Timeline events can only be deleted by admins"
  ON public.complaint_timeline FOR DELETE
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- E. PROPOSALS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Proposals are viewable by authenticated users" ON public.proposals;
CREATE POLICY "Proposals are viewable by authenticated users"
  ON public.proposals FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can submit proposals" ON public.proposals;
CREATE POLICY "Authenticated users can submit proposals"
  ON public.proposals FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (author_id = auth.uid() OR public.is_admin())
  );

DROP POLICY IF EXISTS "Proposal update policy" ON public.proposals;
CREATE POLICY "Proposal update policy"
  ON public.proposals FOR UPDATE
  USING (
    public.is_admin()
    OR (
      auth.uid() = author_id
      AND status = 'Under Review'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = author_id
      AND status = 'Under Review'
    )
  );

DROP POLICY IF EXISTS "Only admins can delete proposals" ON public.proposals;
CREATE POLICY "Only admins can delete proposals"
  ON public.proposals FOR DELETE
  USING (public.is_admin());

-- --------------------------------------------------------------------
-- F. PROPOSAL VOTES POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Votes are viewable by authenticated users" ON public.proposal_votes;
CREATE POLICY "Votes are viewable by authenticated users"
  ON public.proposal_votes FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can only vote for themselves" ON public.proposal_votes;
CREATE POLICY "Users can only vote for themselves"
  ON public.proposal_votes FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Votes cannot be updated" ON public.proposal_votes;
CREATE POLICY "Votes cannot be updated"
  ON public.proposal_votes FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Users can withdraw their own vote" ON public.proposal_votes;
CREATE POLICY "Users can withdraw their own vote"
  ON public.proposal_votes FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- --------------------------------------------------------------------
-- G. NOTIFICATIONS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can only view their own notifications" ON public.notifications;
CREATE POLICY "Users can only view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Only admins or system can insert notifications" ON public.notifications;
CREATE POLICY "Only admins or system can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can only mark own notifications as read" ON public.notifications;
CREATE POLICY "Users can only mark own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = user_id
      AND title = (SELECT n.title FROM public.notifications n WHERE n.id = notifications.id)
      AND message = (SELECT n.message FROM public.notifications n WHERE n.id = notifications.id)
      AND type = (SELECT n.type FROM public.notifications n WHERE n.id = notifications.id)
    )
  );

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ====================================================================
-- 6. PRIVACY VIEWS & SECURE RPC FUNCTIONS
-- ====================================================================

-- --------------------------------------------------------------------
-- VIEW: public.public_profiles
-- Exposes safe display info (name, role, department) while hiding email & phone.
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  id,
  full_name,
  role,
  department
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
REVOKE ALL ON public.public_profiles FROM anon;

-- RPC to look up display information for a user safely
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role TEXT,
  department TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.full_name, p.role, p.department
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- VIEW: public.shared_complaints
-- Architectural Notes on View Security:
-- 1. Security Invoker vs Definer:
--    Underlying table `public.complaints` has strict RLS allowing only author or admin.
--    If `security_invoker = true` were specified here, Student B querying shared
--    complaints would be evaluated against `public.complaints` RLS as Student B and
--    receive ZERO rows. Thus, this view operates as a security definer projection
--    (security_invoker = false, the default in PostgreSQL) to expose a safe, sanitised
--    projection across tenants.
-- 2. Security Barrier:
--    `security_barrier = true` is enabled to enforce that PostgreSQL query optimizer
--    cannot push user-supplied filter predicates or functions ahead of the view's
--    row-filters and CASE-masking expressions (preventing side-channel timing/error leaks).
-- 3. Unauthorized direct access is strictly prevented because direct table SELECT on
--    `public.complaints` remains locked to `auth.uid() = reporter_id OR public.is_admin()`.
-- 4. Private fields (reporter UUID, internal resolution notes, reporter contact info)
--    are masked as NULL or generic labels for third-party students.
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW public.shared_complaints
WITH (security_barrier = true)
AS
SELECT
  c.id,
  c.title,
  c.description,
  c.category,
  c.building,
  c.room,
  c.urgency,
  c.affected,
  c.priority,
  c.predicted_priority,
  c.confidence,
  c.status,
  c.image_url,
  c.linked_complaint_id,
  c.created_at,
  c.updated_at,
  -- Anonymize student reporter name for third parties; only reveal to author or admin
  CASE
    WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.reporter
    ELSE 'Campus Resident'
  END AS reporter,
  -- Hide raw reporter_id UUID from third parties
  CASE
    WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.reporter_id
    ELSE NULL::UUID
  END AS reporter_id,
  -- Hide internal resolution notes from third parties
  CASE
    WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.resolution_note
    ELSE NULL::TEXT
  END AS resolution_note
FROM public.complaints c
WHERE
  (auth.role() = 'authenticated')
  AND (
    public.is_admin()
    OR auth.uid() = c.reporter_id
    OR c.status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')
  );

REVOKE ALL ON public.shared_complaints FROM PUBLIC;
REVOKE ALL ON public.shared_complaints FROM anon;
GRANT SELECT ON public.shared_complaints TO authenticated;

-- RPC: get_shared_complaints
-- PostgREST RPC function for fetching shared complaints safely with server-side authorization
CREATE OR REPLACE FUNCTION public.get_shared_complaints()
RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  building TEXT,
  room TEXT,
  urgency TEXT,
  affected INTEGER,
  priority TEXT,
  predicted_priority TEXT,
  confidence NUMERIC(4,3),
  status TEXT,
  reporter TEXT,
  image_url TEXT,
  linked_complaint_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict server-side authorization check: reject unauthenticated access
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required to access campus complaints';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.category,
    c.building,
    c.room,
    c.urgency,
    c.affected,
    c.priority,
    c.predicted_priority,
    c.confidence,
    c.status,
    CASE
      WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.reporter
      ELSE 'Campus Resident'
    END AS reporter,
    c.image_url,
    c.linked_complaint_id,
    c.created_at,
    c.updated_at
  FROM public.complaints c
  WHERE
    public.is_admin()
    OR auth.uid() = c.reporter_id
    OR c.status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved');
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_complaints() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_complaints() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shared_complaints() TO authenticated;

-- RPC: get_complaint_by_id
-- Safely resolves a complaint for detail page viewing with strict field masking
CREATE OR REPLACE FUNCTION public.get_complaint_by_id(complaint_id_param TEXT)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  building TEXT,
  room TEXT,
  urgency TEXT,
  affected INTEGER,
  priority TEXT,
  predicted_priority TEXT,
  confidence NUMERIC(4,3),
  status TEXT,
  reporter TEXT,
  reporter_id UUID,
  image_url TEXT,
  resolution_note TEXT,
  linked_complaint_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_owner_or_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict server-side authorization check: reject unauthenticated access
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required to access complaint details';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.category,
    c.building,
    c.room,
    c.urgency,
    c.affected,
    c.priority,
    c.predicted_priority,
    c.confidence,
    c.status,
    CASE
      WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.reporter
      ELSE 'Campus Resident'
    END AS reporter,
    CASE
      WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.reporter_id
      ELSE NULL::UUID
    END AS reporter_id,
    c.image_url,
    CASE
      WHEN auth.uid() = c.reporter_id OR public.is_admin() THEN c.resolution_note
      ELSE NULL::TEXT
    END AS resolution_note,
    c.linked_complaint_id,
    c.created_at,
    c.updated_at,
    (auth.uid() = c.reporter_id OR public.is_admin()) AS is_owner_or_admin
  FROM public.complaints c
  WHERE c.id = complaint_id_param
    AND (
      public.is_admin()
      OR auth.uid() = c.reporter_id
      OR c.status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_complaint_by_id(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_complaint_by_id(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_complaint_by_id(TEXT) TO authenticated;

-- --------------------------------------------------------------------
-- HELPER FUNCTION: public.can_access_complaint_image
-- Narrowly scoped SECURITY DEFINER function to check storage read authorization
-- without requiring unrestricted SELECT access to public.complaints.
-- Uses EXACT path matching (no wildcards or loose LIKE).
-- --------------------------------------------------------------------
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
-- 7. INTEGRITY TRIGGERS
-- ====================================================================

-- --------------------------------------------------------------------
-- TRIGGER 0: Protect Profile Fields from Student Tampering
-- Enforces that role cannot be self-promoted or demoted by non-admins,
-- and preserves user ID and email. Admins (including the trusted
-- provisioning procedure running in SQL Editor) can update freely.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Administrators (including SQL Editor direct execution) have full update privileges
  IF public.is_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  -- Non-admin users (students):
  -- 1. Students can only update their own profile
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'You are not authorized to update this profile';
  END IF;

  -- 2. Prevent role self-promotion or demotion: role is immutable for students
  NEW.role := OLD.role;

  -- 3. Prevent changing user ID or email (managed by auth system)
  NEW.id := OLD.id;
  NEW.email := OLD.email;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- --------------------------------------------------------------------
-- TRIGGER 1: Enforce Complaint Insert & Update Integrity
-- Ensures safe initial status ('Submitted'), validates reporter_id,
-- and prevents students from altering priority, status, or notes.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_complaint_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin() THEN
      NEW.reporter_id := auth.uid();
      NEW.status := 'Submitted';
      NEW.resolution_note := NULL;
      IF NEW.priority IS NULL THEN
        NEW.priority := COALESCE(NEW.predicted_priority, 'Medium');
      END IF;
    END IF;
    NEW.created_at := timezone('utc'::text, now());
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin() THEN
      IF OLD.reporter_id <> auth.uid() THEN
        RAISE EXCEPTION 'You can only update your own complaints';
      END IF;
      IF OLD.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Complaints can only be edited while in Submitted status';
      END IF;
      -- Preserve administrative / machine learning fields
      NEW.id := OLD.id;
      NEW.status := OLD.status;
      NEW.priority := OLD.priority;
      NEW.predicted_priority := OLD.predicted_priority;
      NEW.confidence := OLD.confidence;
      NEW.prediction_source := OLD.prediction_source;
      NEW.reporter_id := OLD.reporter_id;
      NEW.resolution_note := OLD.resolution_note;
    END IF;
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_complaint_integrity ON public.complaints;
CREATE TRIGGER trg_enforce_complaint_integrity
  BEFORE INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.enforce_complaint_integrity();

-- --------------------------------------------------------------------
-- TRIGGER 2: Enforce Follow-up Integrity
-- Verifies author_id against auth.uid() and ensures student owns complaint.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_follow_up_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.author_id := auth.uid();
    IF NOT EXISTS (
      SELECT 1 FROM public.complaints
      WHERE id = NEW.complaint_id AND reporter_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'You can only add follow-ups to your own complaints';
    END IF;
  END IF;
  NEW.created_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_follow_up_integrity ON public.complaint_follow_ups;
CREATE TRIGGER trg_enforce_follow_up_integrity
  BEFORE INSERT ON public.complaint_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_follow_up_integrity();

-- --------------------------------------------------------------------
-- TRIGGER 3: Enforce Timeline Integrity
-- Prevents student forgery of admin status changes ('In Progress', 'Resolved').
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_timeline_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.status <> 'Submitted' THEN
      RAISE EXCEPTION 'Only administrators can record status transitions';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.complaints
      WHERE id = NEW.complaint_id AND reporter_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Cannot add timeline events to complaints you do not own';
    END IF;
  END IF;
  NEW.created_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_timeline_integrity ON public.complaint_timeline;
CREATE TRIGGER trg_enforce_timeline_integrity
  BEFORE INSERT ON public.complaint_timeline
  FOR EACH ROW EXECUTE FUNCTION public.enforce_timeline_integrity();

-- --------------------------------------------------------------------
-- TRIGGER 4: Proposal Support Count & Vote Handler
-- Resolves conflict: Accurately syncs support_count from votes
-- while preventing manual vote tampering.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_proposal_vote_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.proposals
    SET support_count = support_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.proposal_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.proposals
    SET support_count = GREATEST(1, support_count - 1),
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.proposal_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_proposal_vote_changed ON public.proposal_votes;
CREATE TRIGGER on_proposal_vote_changed
  AFTER INSERT OR DELETE ON public.proposal_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_proposal_vote_change();

-- --------------------------------------------------------------------
-- TRIGGER 5: Protect Proposal Fields from Student Tampering
-- Distinguishes between vote-trigger-invoked updates (pg_trigger_depth() > 1)
-- and direct user updates, preventing students from directly overwriting
-- support_count, status, or admin_note.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_proposal_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- If invoked from the vote trigger (pg_trigger_depth() > 1), allow support_count update
  IF pg_trigger_depth() > 1 THEN
    NEW.id := OLD.id;
    NEW.title := OLD.title;
    NEW.description := OLD.description;
    NEW.category := OLD.category;
    NEW.location := OLD.location;
    NEW.status := OLD.status;
    NEW.author := OLD.author;
    NEW.author_id := OLD.author_id;
    NEW.admin_note := OLD.admin_note;
    RETURN NEW;
  END IF;

  -- Direct student update: author can edit proposal info while Under Review
  IF auth.uid() <> OLD.author_id THEN
    RAISE EXCEPTION 'You are not authorized to update this proposal';
  END IF;

  IF OLD.status <> 'Under Review' THEN
    RAISE EXCEPTION 'Proposals can only be edited while Under Review';
  END IF;

  -- Block manual tampering with protected fields
  NEW.id := OLD.id;
  NEW.status := OLD.status;
  NEW.author := OLD.author;
  NEW.author_id := OLD.author_id;
  NEW.admin_note := OLD.admin_note;
  NEW.support_count := OLD.support_count; -- Tampering prevented

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_proposal_fields ON public.proposals;
CREATE TRIGGER trg_protect_proposal_fields
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.protect_proposal_fields();

-- --------------------------------------------------------------------
-- TRIGGER 6: Safe Profile Creation on Auth Sign-Up
-- SECURITY NOTE: By default, ALL users registered via public sign-up receive role = 'student'.
-- Public registration CANNOT automatically claim or escalate to 'admin' privileges,
-- even if signing up with adminfix@gmail.com.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'student',
    COALESCE(NEW.raw_user_meta_data ->> 'department', 'General')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 8. INITIAL SECURE ADMIN PROVISIONING PROCEDURE
-- ====================================================================
-- This SECURITY DEFINER procedure executes with database-owner privileges.
-- It can be executed directly in the Supabase Dashboard SQL Editor after
-- the administrator account is created in Authentication -> Users.
--
-- Why this is required:
-- 1. `protect_profile_fields()` and RLS prevent non-admin users from altering their own role.
-- 2. `is_admin()` checks both `auth.jwt() -> 'app_metadata' ->> 'role'` and `public.profiles.role`.
--    Updating `auth.users.raw_app_meta_data` ensures future JWT tokens contain `app_metadata.role = 'admin'`.
-- 3. This procedure is REVOKED from all client roles (anon, authenticated, PUBLIC)
--    so it cannot be invoked from frontend code or public signups.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.provision_initial_admin(admin_email TEXT DEFAULT 'adminfix@gmail.com')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Look up target user in auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower(admin_email);

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Notice: User % does not exist in auth.users yet. Create user in Authentication -> Users first, then run: SELECT public.provision_initial_admin();', admin_email;
    RETURN;
  END IF;

  -- 1. Synchronize auth.users raw_app_meta_data (embedded into JWT app_metadata on login)
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = target_user_id;

  -- 2. Upsert profile with verified 'admin' role
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (target_user_id, lower(admin_email), 'FixLens Administrator', 'admin', 'Campus Facilities')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      full_name = 'FixLens Administrator',
      department = 'Campus Facilities',
      updated_at = timezone('utc'::text, now());

  RAISE NOTICE 'Success: % has been provisioned as verified FixLens Administrator.', admin_email;
END;
$$;

-- Restrict execution: cannot be called by anon, authenticated students, or public
REVOKE ALL ON FUNCTION public.provision_initial_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_initial_admin(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.provision_initial_admin(TEXT) FROM authenticated;

-- Execute initial provisioning check immediately (succeeds if user already exists)
SELECT public.provision_initial_admin('adminfix@gmail.com');
SELECT public.provision_initial_admin('adminfixes@gmail.com');
