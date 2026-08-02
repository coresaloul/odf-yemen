
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('executive_director','manager','employee');
CREATE TYPE public.task_status AS ENUM ('new','in_progress','completed','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.employee_status AS ENUM ('active','on_leave','terminated');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','leave','holiday');
CREATE TYPE public.period_type AS ENUM ('daily','weekly','monthly','quarterly','semiannual');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'executive_director');
$$;

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  manager_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- SECTIONS
CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  manager_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  job_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  hire_date date,
  status public.employee_status NOT NULL DEFAULT 'active',
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments ADD CONSTRAINT departments_manager_fk FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.sections ADD CONSTRAINT sections_manager_fk FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- can the current user supervise the given employee?
CREATE OR REPLACE FUNCTION public.can_supervise(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'executive_director')
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = _employee_id
          AND (
            e.manager_id = public.current_employee_id()
            OR e.department_id IN (SELECT d.id FROM public.departments d WHERE d.manager_id = public.current_employee_id())
            OR e.section_id IN (SELECT s.id FROM public.sections s WHERE s.manager_id = public.current_employee_id())
          )
      );
$$;

CREATE OR REPLACE FUNCTION public.is_self_employee(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _employee_id = public.current_employee_id();
$$;

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'new',
  progress integer NOT NULL DEFAULT 0,
  weight integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  created_via_voice boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  note text,
  progress integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_updates TO authenticated;
GRANT ALL ON public.task_updates TO service_role;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;

-- ATTENDANCE
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in time,
  check_out time,
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- EVALUATIONS
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period public.period_type NOT NULL DEFAULT 'monthly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  tasks_score numeric(5,2) NOT NULL DEFAULT 0,
  attendance_score numeric(5,2) NOT NULL DEFAULT 0,
  criteria_score numeric(5,2) NOT NULL DEFAULT 0,
  total_score numeric(5,2) NOT NULL DEFAULT 0,
  grade text,
  notes text,
  approved boolean NOT NULL DEFAULT false,
  evaluator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.evaluation_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight integer NOT NULL DEFAULT 1,
  score numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_criteria TO authenticated;
GRANT ALL ON public.evaluation_criteria TO service_role;
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "roles_select_own_or_director" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_director());

CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write" ON public.departments FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

CREATE POLICY "sections_select" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections_write" ON public.sections FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_write" ON public.employees FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_self_employee(assignee_id) OR public.can_supervise(assignee_id));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_supervise(assignee_id));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_self_employee(assignee_id) OR public.can_supervise(assignee_id))
  WITH CHECK (public.is_self_employee(assignee_id) OR public.can_supervise(assignee_id));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.can_supervise(assignee_id));

CREATE POLICY "task_updates_select" ON public.task_updates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (public.is_self_employee(t.assignee_id) OR public.can_supervise(t.assignee_id))));
CREATE POLICY "task_updates_insert" ON public.task_updates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (public.is_self_employee(t.assignee_id) OR public.can_supervise(t.assignee_id))));

CREATE POLICY "attendance_select" ON public.attendance_records FOR SELECT TO authenticated
  USING (public.is_self_employee(employee_id) OR public.can_supervise(employee_id));
CREATE POLICY "attendance_write" ON public.attendance_records FOR ALL TO authenticated
  USING (public.is_director()) WITH CHECK (public.is_director());

CREATE POLICY "evaluations_select" ON public.evaluations FOR SELECT TO authenticated
  USING (public.is_self_employee(employee_id) OR public.can_supervise(employee_id));
CREATE POLICY "evaluations_write" ON public.evaluations FOR ALL TO authenticated
  USING (public.can_supervise(employee_id)) WITH CHECK (public.can_supervise(employee_id));

CREATE POLICY "criteria_select" ON public.evaluation_criteria FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND (public.is_self_employee(e.employee_id) OR public.can_supervise(e.employee_id))));
CREATE POLICY "criteria_write" ON public.evaluation_criteria FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND public.can_supervise(e.employee_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND public.can_supervise(e.employee_id)));

-- TRIGGERS
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_evaluations_updated BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NEW USER HANDLING: profile + link employee by email + first user becomes director
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  role_count integer;
  linked_employee public.employees%ROWTYPE;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.employees SET user_id = NEW.id
  WHERE user_id IS NULL AND lower(email) = lower(NEW.email)
  RETURNING * INTO linked_employee;

  SELECT count(*) INTO role_count FROM public.user_roles;
  IF role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'executive_director');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
