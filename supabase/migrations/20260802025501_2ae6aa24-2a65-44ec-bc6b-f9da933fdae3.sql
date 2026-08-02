-- 1) Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  entity_label text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admins" ON public.audit_log
FOR SELECT TO authenticated
USING (private.is_director() OR private.is_hr());

CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log (entity, entity_id);

-- 2) Referential integrity: block deletes that would orphan data
ALTER TABLE public.sections DROP CONSTRAINT sections_department_id_fkey;
ALTER TABLE public.sections ADD CONSTRAINT sections_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;

ALTER TABLE public.employees DROP CONSTRAINT employees_department_id_fkey;
ALTER TABLE public.employees ADD CONSTRAINT employees_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;

ALTER TABLE public.employees DROP CONSTRAINT employees_section_id_fkey;
ALTER TABLE public.employees ADD CONSTRAINT employees_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE RESTRICT;

-- 3) Uniqueness rules
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_unique_idx
  ON public.departments (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS sections_dept_name_unique_idx
  ON public.sections (department_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_no_unique_idx
  ON public.employees (lower(btrim(employee_no)));

-- 4) Prevent manager cycles
CREATE OR REPLACE FUNCTION private.prevent_manager_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cursor_id uuid;
  guard int := 0;
BEGIN
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'لا يمكن أن يكون الموظف مديراً لنفسه';
  END IF;
  cursor_id := NEW.manager_id;
  WHILE cursor_id IS NOT NULL AND guard < 50 LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'لا يمكن إنشاء دائرة إشراف مغلقة بين الموظفين';
    END IF;
    SELECT manager_id INTO cursor_id FROM public.employees WHERE id = cursor_id;
    guard := guard + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_manager_cycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employees_prevent_manager_cycle ON public.employees;
CREATE TRIGGER employees_prevent_manager_cycle
BEFORE INSERT OR UPDATE OF manager_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.prevent_manager_cycle();