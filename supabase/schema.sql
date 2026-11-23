-- LabLink Complete Supabase PostgreSQL Schema
-- Includes Row Level Security (RLS), Authorized Admin Registry, Faculty Approval Workflow,
-- Project Access Requests, Database-Level Double-Booking Exclusion, and Smart Booking Conflict Logs.
-- Safe to run repeatedly in your Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Profiles & Role Management (linked 1:1 to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'faculty', 'admin')),
  faculty_approval_status TEXT NOT NULL DEFAULT 'none' CHECK (faculty_approval_status IN ('none', 'pending', 'approved', 'rejected')),
  department TEXT NOT NULL DEFAULT 'Bioengineering',
  title TEXT NOT NULL DEFAULT 'Student Researcher',
  weekly_quota_hours NUMERIC(5,2) NOT NULL DEFAULT 6.00,
  used_hours_this_week NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  certifications TEXT[] NOT NULL DEFAULT ARRAY['General Lab Safety'],
  assigned_lab_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Authorised Admin Account List (only existing admins or service role can grant admin access)
CREATE TABLE IF NOT EXISTS public.authorized_admins (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Platform Administrator',
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_by TEXT NOT NULL DEFAULT 'System Setup',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Departments & Laboratories
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  head_name TEXT NOT NULL,
  uptime_percent NUMERIC(5,2) NOT NULL DEFAULT 98.00,
  accent_color TEXT NOT NULL DEFAULT 'mint' CHECK (accent_color IN ('mint', 'blue', 'pink', 'butter')),
  icon TEXT NOT NULL DEFAULT 'science',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.laboratories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  building TEXT NOT NULL,
  room TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'General Lab Safety',
  capacity INTEGER NOT NULL DEFAULT 10,
  occupied INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'high_load', 'calibrating', 'closed')),
  manager_name TEXT NOT NULL,
  manager_title TEXT NOT NULL DEFAULT 'Lab Coordinator',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lat NUMERIC(9,6) NOT NULL DEFAULT 42.360000,
  lng NUMERIC(9,6) NOT NULL DEFAULT -71.090000,
  x_percent NUMERIC(5,2) NOT NULL DEFAULT 50,
  y_percent NUMERIC(5,2) NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Equipment Catalog
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Electronics & Circuits',
    '3D Printing & Making',
    'Robotics',
    'Computers & Software',
    'Testing & Measurement',
    'Mechanical Workshop'
  )),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  laboratory_id UUID NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  location_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
  hourly_rate NUMERIC(8,2) NOT NULL DEFAULT 15.00,
  requires_faculty_approval BOOLEAN NOT NULL DEFAULT FALSE,
  certification_required TEXT NOT NULL DEFAULT 'General Lab Safety',
  biosafety_level TEXT NOT NULL DEFAULT 'Sample Lab Data',
  next_slot_label TEXT NOT NULL DEFAULT 'Today, 1:00 PM',
  last_calibrated_label TEXT NOT NULL DEFAULT 'Nov 15',
  total_bookings INTEGER NOT NULL DEFAULT 0,
  short_purpose TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  specs_preview TEXT NOT NULL,
  specs JSONB NOT NULL DEFAULT '[]'::jsonb,
  guidelines JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT NOT NULL DEFAULT '',
  clay_theme TEXT NOT NULL DEFAULT 'arduino',
  is_sample_data BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Student Research Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  grant_code TEXT NOT NULL DEFAULT 'CAMPUS-LAB',
  department TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline DATE NOT NULL,
  progress INTEGER NOT NULL DEFAULT 15 CHECK (progress BETWEEN 0 AND 100),
  tone TEXT NOT NULL DEFAULT 'mint' CHECK (tone IN ('mint', 'blue', 'pink')),
  icon TEXT NOT NULL DEFAULT 'science',
  recommended_equipment_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ai_analysis_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_access', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Project-Based Equipment Access Requests
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  requested_hours NUMERIC(5,2) NOT NULL DEFAULT 2.00 CHECK (requested_hours > 0 AND requested_hours <= 40),
  preferred_date DATE NOT NULL DEFAULT CURRENT_DATE,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'alternative_suggested')),
  suggested_alternative JSONB,
  faculty_reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  faculty_reviewer_name TEXT,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Bookings with Database-Level Atomic Overlap Prevention (btree_gist)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 7 AND 21),
  duration_hours INTEGER NOT NULL CHECK (duration_hours BETWEEN 1 AND 8),
  time_range INT4RANGE GENERATED ALWAYS AS (int4range(start_hour, start_hour + duration_hours)) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'rejected', 'cancelled', 'alternative_suggested')),
  total_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  urgency_tag TEXT,
  ai_note TEXT,
  suggested_alternative JSONB,
  faculty_reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  faculty_reviewer_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
    equipment_id WITH =,
    booking_date WITH =,
    time_range WITH &&
  ) WHERE (status IN ('confirmed', 'pending'))
);

-- 8. Smart Booking Conflict Resolutions
CREATE TABLE IF NOT EXISTS public.conflict_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code TEXT NOT NULL UNIQUE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  conflict_start_hour INTEGER NOT NULL,
  conflict_end_hour INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_ai', 'overridden_faculty')),
  fairness_score INTEGER NOT NULL CHECK (fairness_score BETWEEN 0 AND 100),
  headline_recommendation TEXT NOT NULL,
  explanation TEXT NOT NULL,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_alternative_id TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Maintenance & Notifications
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  technician TEXT NOT NULL,
  task_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'cleared')),
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('confirmed', 'warning', 'ai', 'info')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage bucket for optional equipment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-images', 'equipment-images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Authoritative role & lab-assignment helper functions
CREATE OR REPLACE FUNCTION public.is_authorized_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.authorized_admins a
      ON LOWER(a.email) = LOWER(p.email)
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT CASE
    WHEN public.is_authorized_admin() THEN 'admin'
    ELSE COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'student')
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.faculty_manages_equipment(p_equipment_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.equipment e
    JOIN public.profiles p ON p.id = auth.uid()
    LEFT JOIN public.laboratories l ON l.id = e.laboratory_id
    WHERE e.id = p_equipment_id
      AND p.role = 'faculty'
      AND (
        l.manager_id = auth.uid()
        OR e.laboratory_id = ANY(p.assigned_lab_ids)
        OR COALESCE(array_length(p.assigned_lab_ids, 1), 0) = 0
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Anonymized availability slot helper (prevents leaking student booking PII publicly)
CREATE OR REPLACE FUNCTION public.get_equipment_busy_slots(p_equipment_id UUID DEFAULT NULL)
RETURNS TABLE (
  equipment_id UUID,
  booking_date DATE,
  start_hour INTEGER,
  duration_hours INTEGER,
  status TEXT
) AS $$
  SELECT b.equipment_id, b.booking_date, b.start_hour, b.duration_hours, b.status
  FROM public.bookings b
  WHERE b.status IN ('confirmed', 'pending')
    AND (p_equipment_id IS NULL OR b.equipment_id = p_equipment_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-create safe student profile on auth.users signup (never self-escalates to faculty/admin)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_requested_role TEXT := LOWER(COALESCE(NEW.raw_user_meta_data->>'requested_role', 'student'));
  v_faculty_status TEXT := CASE WHEN v_requested_role = 'faculty' THEN 'pending' ELSE 'none' END;
  v_full_name TEXT := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  v_department TEXT := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'department'), ''), 'Bioengineering');
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, faculty_approval_status, department, title
  ) VALUES (
    NEW.id,
    LOWER(NEW.email),
    v_full_name,
    'student',
    v_faculty_status,
    v_department,
    CASE WHEN v_faculty_status = 'pending'
      THEN 'Faculty Applicant • ' || v_department
      ELSE 'Student Researcher • ' || v_department
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Prevent non-admin users from escalating role, approval status, quota, or lab assignments
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.faculty_approval_status IS DISTINCT FROM OLD.faculty_approval_status
    OR NEW.assigned_lab_ids IS DISTINCT FROM OLD.assigned_lab_ids
    OR NEW.weekly_quota_hours IS DISTINCT FROM OLD.weekly_quota_hours
  ) AND NOT public.is_authorized_admin() THEN
    RAISE EXCEPTION 'Only an authorized administrator may modify roles, approvals, or lab assignments.';
  END IF;

  IF NEW.role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.authorized_admins WHERE LOWER(email) = LOWER(NEW.email)
  ) THEN
    RAISE EXCEPTION 'User email must be in authorized_admins before receiving admin role.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- Public catalog read policies (no PII)
DROP POLICY IF EXISTS "Departments readable publicly" ON public.departments;
CREATE POLICY "Departments readable publicly" ON public.departments FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Labs readable publicly" ON public.laboratories;
CREATE POLICY "Labs readable publicly" ON public.laboratories FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Equipment readable publicly" ON public.equipment;
CREATE POLICY "Equipment readable publicly" ON public.equipment FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Maintenance readable by signed-in users" ON public.maintenance_logs;
CREATE POLICY "Maintenance readable by signed-in users" ON public.maintenance_logs FOR SELECT TO authenticated USING (TRUE);

-- Admin-only catalog & allowlist management
DROP POLICY IF EXISTS "Authorized admins manage admin list" ON public.authorized_admins;
CREATE POLICY "Authorized admins manage admin list" ON public.authorized_admins FOR ALL TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

DROP POLICY IF EXISTS "Admins manage labs" ON public.laboratories;
CREATE POLICY "Admins manage labs" ON public.laboratories FOR ALL TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

DROP POLICY IF EXISTS "Admins manage equipment" ON public.equipment;
CREATE POLICY "Admins manage equipment" ON public.equipment FOR ALL TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

DROP POLICY IF EXISTS "Faculty update assigned lab equipment status" ON public.equipment;
CREATE POLICY "Faculty update assigned lab equipment status" ON public.equipment FOR UPDATE TO authenticated
  USING (public.faculty_manages_equipment(id))
  WITH CHECK (public.faculty_manages_equipment(id));

DROP POLICY IF EXISTS "Faculty and admins manage maintenance" ON public.maintenance_logs;
CREATE POLICY "Faculty and admins manage maintenance" ON public.maintenance_logs FOR ALL TO authenticated
  USING (public.is_authorized_admin() OR public.faculty_manages_equipment(equipment_id))
  WITH CHECK (public.is_authorized_admin() OR public.faculty_manages_equipment(equipment_id));

-- Profiles policies
DROP POLICY IF EXISTS "Users view own profile or faculty/admin view relevant" ON public.profiles;
CREATE POLICY "Users view own profile or faculty/admin view relevant" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_role() IN ('faculty', 'admin'));

DROP POLICY IF EXISTS "Users insert own student profile only" ON public.profiles;
CREATE POLICY "Users insert own student profile only" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'student');

DROP POLICY IF EXISTS "Users update own profile fields" ON public.profiles;
CREATE POLICY "Users update own profile fields" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all profiles and roles" ON public.profiles;
CREATE POLICY "Admins manage all profiles and roles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

-- Projects policies
DROP POLICY IF EXISTS "Users view own projects and faculty/admin view all" ON public.projects;
CREATE POLICY "Users view own projects and faculty/admin view all" ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.current_user_role() IN ('faculty', 'admin'));

DROP POLICY IF EXISTS "Students create own projects" ON public.projects;
CREATE POLICY "Students create own projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners update own projects" ON public.projects;
CREATE POLICY "Owners update own projects" ON public.projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Access Requests policies
DROP POLICY IF EXISTS "View own access requests or assigned faculty/admin" ON public.access_requests;
CREATE POLICY "View own access requests or assigned faculty/admin" ON public.access_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
  );

DROP POLICY IF EXISTS "Create own access requests" ON public.access_requests;
CREATE POLICY "Create own access requests" ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Update own pending or faculty/admin review access requests" ON public.access_requests;
CREATE POLICY "Update own pending or faculty/admin review access requests" ON public.access_requests FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
  );

-- Bookings policies (strictly authenticated; public sees only anonymized busy slots via RPC)
DROP POLICY IF EXISTS "View own bookings or faculty/admin view assigned" ON public.bookings;
CREATE POLICY "View own bookings or faculty/admin view assigned" ON public.bookings FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
  );

DROP POLICY IF EXISTS "Create booking for self" ON public.bookings;
CREATE POLICY "Create booking for self" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Cancel own booking or assigned faculty/admin approve" ON public.bookings;
CREATE POLICY "Cancel own booking or assigned faculty/admin approve" ON public.bookings FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
  );

-- Conflict Resolutions policies
DROP POLICY IF EXISTS "View relevant conflicts" ON public.conflict_resolutions;
CREATE POLICY "View relevant conflicts" ON public.conflict_resolutions FOR SELECT TO authenticated
  USING (
    public.is_authorized_admin()
    OR public.faculty_manages_equipment(equipment_id)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(candidates) elem
      WHERE elem->>'studentId' = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Faculty and admins resolve conflicts" ON public.conflict_resolutions;
CREATE POLICY "Faculty and admins resolve conflicts" ON public.conflict_resolutions FOR ALL TO authenticated
  USING (public.is_authorized_admin() OR public.faculty_manages_equipment(equipment_id))
  WITH CHECK (public.is_authorized_admin() OR public.faculty_manages_equipment(equipment_id));

-- Notifications policies
DROP POLICY IF EXISTS "Users view and mark own notifications" ON public.notifications;
CREATE POLICY "Users view and mark own notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
