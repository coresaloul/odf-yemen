-- ═══════════ حالة حضور جديدة: إذن ═══════════
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'permission';

-- ═══════════ إعدادات الدوام ═══════════
CREATE TABLE public.work_settings (
  id boolean PRIMARY KEY DEFAULT true,
  work_days smallint[] NOT NULL DEFAULT '{0,1,2,3,4}',
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '15:00',
  grace_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_settings_singleton CHECK (id)
);
GRANT SELECT ON public.work_settings TO authenticated;
GRANT ALL ON public.work_settings TO service_role;
ALTER TABLE public.work_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_settings_select" ON public.work_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.work_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ═══════════ العطل الرسمية ═══════════
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  recurring_annually boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays_select" ON public.holidays FOR SELECT TO authenticated USING (true);

-- ═══════════ أنواع الإجازات ═══════════
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  annual_days numeric(6,2) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT true,
  requires_attachment boolean NOT NULL DEFAULT false,
  is_hourly boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_types_select" ON public.leave_types FOR SELECT TO authenticated USING (true);

INSERT INTO public.leave_types (code, name, annual_days, is_paid, requires_attachment, is_hourly, position) VALUES
  ('annual',    'إجازة سنوية',       30, true,  false, false, 1),
  ('sick',      'إجازة مرضية',       15, true,  true,  false, 2),
  ('emergency', 'إجازة طارئة',        5, true,  false, false, 3),
  ('unpaid',    'إجازة بدون راتب',    0, false, false, false, 4),
  ('maternity', 'إجازة أمومة',       70, true,  true,  false, 5),
  ('paternity', 'إجازة أبوة',         3, true,  false, false, 6),
  ('hajj',      'إجازة حج',          15, true,  false, false, 7),
  ('marriage',  'إجازة زواج',         7, true,  false, false, 8),
  ('bereavement','إجازة وفاة',        5, true,  false, false, 9),
  ('permission','إذن ساعي',           0, true,  false, true, 10);

-- ═══════════ طلبات الإجازة ═══════════
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  kind text NOT NULL DEFAULT 'leave',
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  days numeric(6,2) NOT NULL DEFAULT 0,
  hours numeric(5,2) NOT NULL DEFAULT 0,
  reason text,
  attachment_url text,
  stage public.approval_stage NOT NULL DEFAULT 'draft',
  return_reason text,
  submitted_at timestamptz,
  manager_approved_by uuid,
  manager_approved_at timestamptz,
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  director_approved_by uuid,
  director_approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_kind_chk CHECK (kind IN ('leave','permission')),
  CONSTRAINT leave_requests_range_chk CHECK (end_date >= start_date)
);
CREATE INDEX leave_requests_employee_idx ON public.leave_requests(employee_id, start_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_requests_select" ON public.leave_requests FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.can_supervise(employee_id)
         OR private.is_hr() OR private.is_director());
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (private.is_self_employee(employee_id) OR private.can_supervise(employee_id)
              OR private.is_hr() OR private.is_director());
CREATE POLICY "leave_requests_update_own_draft" ON public.leave_requests FOR UPDATE TO authenticated
  USING (private.is_self_employee(employee_id) AND stage IN ('draft','returned'))
  WITH CHECK (private.is_self_employee(employee_id) AND stage IN ('draft','returned'));
CREATE POLICY "leave_requests_delete_own_draft" ON public.leave_requests FOR DELETE TO authenticated
  USING (private.is_self_employee(employee_id) AND stage IN ('draft','returned'));

-- ═══════════ سجل اعتمادات الطلبات ═══════════
CREATE TABLE public.leave_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  stage public.approval_stage NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_approvals TO authenticated;
GRANT ALL ON public.leave_approvals TO service_role;
ALTER TABLE public.leave_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_approvals_select" ON public.leave_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leave_requests r WHERE r.id = request_id
    AND (private.is_self_employee(r.employee_id) OR private.can_supervise(r.employee_id)
         OR private.is_hr() OR private.is_director())));

-- ═══════════ أرصدة الإجازات ═══════════
CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  entitled numeric(6,2) NOT NULL DEFAULT 0,
  carried numeric(6,2) NOT NULL DEFAULT 0,
  used numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);
GRANT SELECT ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_balances_select" ON public.leave_balances FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.can_supervise(employee_id)
         OR private.is_hr() OR private.is_director());

-- ═══════════ حقول إضافية لسجل الحضور ═══════════
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS worked_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permission_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'import',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS attendance_employee_date_idx
  ON public.attendance_records(employee_id, work_date);

-- ═══════════ محدّثات updated_at ═══════════
CREATE TRIGGER work_settings_updated_at BEFORE UPDATE ON public.work_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER holidays_updated_at BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER leave_types_updated_at BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER leave_balances_updated_at BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER attendance_records_updated_at BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();