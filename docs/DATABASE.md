# FixLens AI — Database & Storage Architecture

This document specifies the actual Supabase PostgreSQL schema, Row-Level Security (RLS) policies, storage bucket configurations, and client-side persistence fallbacks for FixLens AI.

---

## 1. Database Architecture Overview

FixLens AI utilizes **Supabase (PostgreSQL 15+)** with **Row-Level Security (RLS)** enabled across all tables. The database manages authentication profiles, maintenance complaints, lifecycle timelines, improvement proposals, votes, notifications, priority escalations, and campus anomalies.

Target Supabase Instance: `https://snwcmuptrvmpniuevofj.supabase.co`

---

## 2. Verified Database Tables

The database schema is defined across:
- `supabase/schema.sql` (Core schema, tables, triggers, helper functions, and RLS policies)
- `supabase/storage.sql` (Storage bucket initialization and access control policies)
- `supabase/migrations/20261102_phase2_escalation_anomalies.sql` (Phase 2 escalation and anomaly tracking)

### Table 1: `public.profiles`
Stores student and administrator user attributes tied directly to `auth.users`.
- **Columns**:
  - `id` (UUID, Primary Key, references `auth.users(id)` ON DELETE CASCADE)
  - `email` (TEXT, NOT NULL, UNIQUE)
  - `full_name` (TEXT, NOT NULL)
  - `role` (TEXT, NOT NULL, CHECK: `role IN ('student', 'admin', 'staff')`, DEFAULT `'student'`)
  - `department` (TEXT, NOT NULL)
  - `phone` (TEXT, NULL)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
  - `updated_at` (TIMESTAMPTZ, DEFAULT `now()`)
- **Key Relationships**: 1-to-1 with `auth.users`.

### Table 2: `public.complaints`
The central registry for campus maintenance complaints.
- **Columns**:
  - `id` (VARCHAR(32), Primary Key) — Collision-resistant ID format `CMP-YYYYMMDD-XXXXXX`.
  - `title` (TEXT, NOT NULL)
  - `description` (TEXT, NOT NULL)
  - `category` (TEXT, NOT NULL, CHECK: `category IN ('Electrical', 'Plumbing', 'Cleaning', 'Wi-Fi', 'Furniture', 'Safety', 'Other')`)
  - `building` (TEXT, NOT NULL)
  - `room` (TEXT, NOT NULL)
  - `urgency` (TEXT, NOT NULL, CHECK: `urgency IN ('Low', 'Medium', 'High')`)
  - `affected` (INTEGER, NOT NULL, CHECK: `affected >= 1 AND affected <= 10000`, DEFAULT 1)
  - `priority` (TEXT, NOT NULL, CHECK: `priority IN ('Low', 'Medium', 'High')`, DEFAULT `'Medium'`)
  - `predicted_priority` (TEXT, NULL, CHECK: `predicted_priority IN ('Low', 'Medium', 'High')`)
  - `confidence` (NUMERIC(5, 4), NULL) — Model confidence score (0.0000 to 1.0000).
  - `status` (TEXT, NOT NULL, CHECK: `status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected')`, DEFAULT `'Submitted'`)
  - `reporter` (TEXT, NOT NULL) — Display name of the reporting student.
  - `reporter_id` (UUID, NOT NULL, references `auth.users(id)`)
  - `image_url` (TEXT, NULL) — Relative storage object path in `complaint-images`.
  - `resolution_note` (TEXT, NULL) — Administrator explanation when resolved or rejected.
  - `linked_complaint_id` (VARCHAR(32), NULL, references `public.complaints(id)`) — Set when identified as duplicate.
  - `escalated_priority` (TEXT, NULL, CHECK: `escalated_priority IN ('Low', 'Medium', 'High')`)
  - `escalation_reasons` (TEXT[], NULL) — Machine or rule-based escalation factors.
  - `is_admin_override` (BOOLEAN, DEFAULT FALSE) — True if admin manually overrode ML priority.
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
  - `updated_at` (TIMESTAMPTZ, DEFAULT `now()`)

### Table 3: `public.complaint_follow_ups`
Allows students to append supplemental information to an existing complaint.
- **Columns**:
  - `id` (UUID, Primary Key, DEFAULT `gen_random_uuid()`)
  - `complaint_id` (VARCHAR(32), NOT NULL, references `public.complaints(id)` ON DELETE CASCADE)
  - `author_id` (UUID, NOT NULL, references `auth.users(id)`)
  - `author_name` (TEXT, NOT NULL)
  - `note` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)

### Table 4: `public.complaint_timeline`
Audit trail of status transitions for a complaint.
- **Columns**:
  - `id` (UUID, Primary Key, DEFAULT `gen_random_uuid()`)
  - `complaint_id` (VARCHAR(32), NOT NULL, references `public.complaints(id)` ON DELETE CASCADE)
  - `status` (TEXT, NOT NULL, CHECK: `status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected')`)
  - `note` (TEXT, NULL)
  - `updated_by` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)

### Table 5: `public.proposals`
Student-submitted campus infrastructure and improvement proposals.
- **Columns**:
  - `id` (VARCHAR(32), Primary Key) — `PROP-XXXXXXXX` or UUID.
  - `title` (TEXT, NOT NULL)
  - `description` (TEXT, NOT NULL)
  - `category` (TEXT, NOT NULL)
  - `location` (TEXT, NOT NULL)
  - `support` (INTEGER, NOT NULL, DEFAULT 1) — Aggregated support votes.
  - `status` (TEXT, NOT NULL, CHECK: `status IN ('Under Review', 'Approved', 'Planned', 'Rejected', 'Completed')`, DEFAULT `'Under Review'`)
  - `author` (TEXT, NOT NULL)
  - `author_id` (UUID, NOT NULL, references `auth.users(id)`)
  - `admin_note` (TEXT, NULL) — Administrator decision explanation.
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
  - `updated_at` (TIMESTAMPTZ, DEFAULT `now()`)

### Table 6: `public.proposal_votes`
Tracks individual student support votes to enforce one vote per student per proposal.
- **Columns**:
  - `id` (UUID, Primary Key, DEFAULT `gen_random_uuid()`)
  - `proposal_id` (VARCHAR(32), NOT NULL, references `public.proposals(id)` ON DELETE CASCADE)
  - `user_id` (UUID, NOT NULL, references `auth.users(id)` ON DELETE CASCADE)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
- **Constraints**: UNIQUE `(proposal_id, user_id)` — strictly prevents duplicate voting.

### Table 7: `public.notifications`
Persistent in-app notifications for students and administrators.
- **Columns**:
  - `id` (UUID, Primary Key, DEFAULT `gen_random_uuid()`)
  - `user_id` (UUID, NOT NULL, references `auth.users(id)` ON DELETE CASCADE)
  - `recipient_email` (TEXT, NOT NULL)
  - `title` (TEXT, NOT NULL)
  - `message` (TEXT, NOT NULL)
  - `type` (TEXT, NOT NULL, CHECK: `type IN ('info', 'status_update', 'duplicate_alert', 'proposal', 'admin_alert', 'anomaly')`)
  - `reference_id` (TEXT, NULL) — Complaint ID or Proposal ID.
  - `is_read` (BOOLEAN, NOT NULL, DEFAULT FALSE)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)

### Table 8: `public.complaint_escalations`
Audit history of ticket priority escalations.
- **Columns**:
  - `id` (UUID, Primary Key, DEFAULT `gen_random_uuid()`)
  - `complaint_id` (VARCHAR(32), NOT NULL, references `public.complaints(id)` ON DELETE CASCADE)
  - `old_priority` (TEXT, NOT NULL)
  - `new_priority` (TEXT, NOT NULL)
  - `reasons` (TEXT[], NOT NULL)
  - `triggered_by` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)

### Table 9: `public.maintenance_anomalies`
Dynamic campus-wide maintenance anomalies detected by rule heuristics.
- **Columns**:
  - `id` (TEXT, Primary Key)
  - `category` (TEXT, NOT NULL)
  - `building` (TEXT, NOT NULL)
  - `severity` (TEXT, NOT NULL, CHECK: `severity IN ('Low', 'Medium', 'High')`)
  - `title` (TEXT, NOT NULL)
  - `details` (TEXT, NOT NULL)
  - `metric` (TEXT, NOT NULL)
  - `status` (TEXT, NOT NULL, CHECK: `status IN ('Active', 'Investigating', 'Resolved')`, DEFAULT `'Active'`)
  - `notes` (TEXT, NULL)
  - `created_at` (TIMESTAMPTZ, DEFAULT `now()`)
  - `updated_at` (TIMESTAMPTZ, DEFAULT `now()`)

---

## 3. Row-Level Security (RLS) Policies

All tables have RLS enabled via `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`.

### Helper Security Function
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$;
```

### Access Policies Breakdown

| Table | Policy Name | Permitted Role | Operation | Condition / Scope |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | "Profiles select authorization" | Authenticated | SELECT | Admins can view all; students can only view own profile (`auth.uid() = id`). |
| `profiles` | "Users can update own details" | Authenticated | UPDATE | Users can update full_name/phone, but `role` cannot be self-modified. |
| `complaints` | "Complaints select authorization" | Authenticated | SELECT | Admins can view all; students view active campus complaints for duplicate checking. |
| `complaints` | "Authenticated users can submit complaints" | Authenticated | INSERT | Must match `auth.uid() = reporter_id`. |
| `complaints` | "Complaint update authorization" | Authenticated | UPDATE | Admins can update any field; students can only update own ticket if not resolved. |
| `complaint_follow_ups`| "Follow-ups select authorization" | Authenticated | SELECT | Allowed for complaint participants and administrators. |
| `complaint_follow_ups`| "Authenticated authors can append" | Authenticated | INSERT | Authors matching `auth.uid() = author_id`. |
| `proposals` | "Proposals are viewable" | Authenticated | SELECT | All authenticated users can browse campus improvement proposals. |
| `proposals` | "Proposal update policy" | Authenticated | UPDATE | Admins can update status & admin notes; authors can update title/description if pending. |
| `proposal_votes` | "Users can only vote for themselves"| Authenticated | INSERT | `auth.uid() = user_id`. |
| `notifications` | "Users can only view own notifications" | Authenticated | SELECT | `auth.uid() = user_id`. |
| `notifications` | "Users can only mark own as read" | Authenticated | UPDATE | `auth.uid() = user_id`. |

---

## 4. Storage Bucket Configuration & Security

- **Bucket Name**: `complaint-images`
- **Visibility**: **Strictly Private** (`public = false`). Direct HTTP access without authorization is denied.
- **Limits**: Maximum 5 MB per file; MIME types restricted to `image/jpeg`, `image/png`, and `image/webp`.
- **Upload Sandboxing**: Students can only upload files into their own user-scoped directory: `<auth.uid()>/<filename>`.
- **Read Authorization Function**:
  ```sql
  CREATE OR REPLACE FUNCTION public.can_access_complaint_image(object_path TEXT)
  RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
  BEGIN
    IF auth.role() <> 'authenticated' THEN RETURN FALSE; END IF;
    IF public.is_admin() THEN RETURN TRUE; END IF;
    IF (split_part(object_path, '/', 1)) = auth.uid()::text THEN RETURN TRUE; END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')
        AND (c.image_url = object_path OR c.image_url = ('complaint-images/' || object_path))
    );
  END;
  $$;
  ```

---

## 5. Client-Side Fallback & LocalStorage Persistence

To maintain continuous offline-first resilience during database connectivity interruptions, specific operational states are stored client-side:

1. **Admin Alert Acknowledgment**:
   - `localStorage.getItem("fixlens_admin_alerts_<email>")`
   - Preserves acknowledged and resolved alert states across browser sessions without creating table locks.
2. **Student In-App Notifications**:
   - `localStorage.getItem("fixlens_student_notifs_<userId>")`
   - Acts as a local queue and cache for student notifications when Supabase connection is offline.
3. **Complaint Report Draft**:
   - `sessionStorage` / in-memory draft state preserves user input during page navigation or transient network errors.
