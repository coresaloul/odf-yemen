-- =========================================================
-- نظام إدارة الورديات والجداول المرنة وحساب الساعات الإضافية
-- =========================================================

-- 1. جدول الورديات
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '15:00',
  work_days integer[] NOT NULL DEFAULT '{0,1,2,3,4}',
  grace_minutes integer NOT NULL DEFAULT 10,
  is_night_shift boolean NOT NULL DEFAULT false,
  overtime_enabled boolean NOT NULL DEFAULT true,
  min_overtime_minutes integer NOT NULL DEFAULT 30,
  color text NOT NULL DEFAULT '#3b82f6',
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_shifts TO authenticated;
GRANT ALL ON public.work_shifts TO service_role;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_shifts_select" ON public.work_shifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "work_shifts_write" ON public.work_shifts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('executive_director', 'hr')
    )
  );

-- 2. جدول تعيين الورديات للموظفين والأقسام والإدارات
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.sections(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_shift_target CHECK (
    (employee_id IS NOT NULL)::int + (department_id IS NOT NULL)::int + (section_id IS NOT NULL)::int = 1
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_assignments TO authenticated;
GRANT ALL ON public.shift_assignments TO service_role;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_assignments_select" ON public.shift_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shift_assignments_write" ON public.shift_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('executive_director', 'hr')
    )
  );

-- 3. تحديث جدول سجلات الحضور بإضافة الوردية والساعات الإضافية
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.work_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0;

-- 4. مشغلات التحديث التلقائي
CREATE TRIGGER work_shifts_updated_at BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER shift_assignments_updated_at BEFORE UPDATE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. إدراج الوردية الصباحية الافتراضية
INSERT INTO public.work_shifts (name, code, start_time, end_time, work_days, grace_minutes, is_default, active, color, notes)
VALUES (
  'الوردية الصباحية القياسية',
  'default-morning',
  '08:00',
  '15:00',
  '{0,1,2,3,4}',
  10,
  true,
  true,
  '#0284c7',
  'الوردية العامة الأساسية لمؤسسة اليتيم التنموية'
)
ON CONFLICT (code) DO NOTHING;
