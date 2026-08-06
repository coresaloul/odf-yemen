-- 1) biometric_punches: ingestion must stay service-role only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.biometric_punches FROM authenticated, anon;
GRANT ALL ON public.biometric_punches TO service_role;

-- 2) employees: allow limited self-service updates, guarded by trigger
CREATE OR REPLACE FUNCTION private.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.is_director() OR private.is_hr() THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    NEW.id := OLD.id;
    NEW.user_id := OLD.user_id;
    NEW.employee_no := OLD.employee_no;
    NEW.full_name := OLD.full_name;
    NEW.job_title := OLD.job_title;
    NEW.department_id := OLD.department_id;
    NEW.section_id := OLD.section_id;
    NEW.manager_id := OLD.manager_id;
    NEW.hire_date := OLD.hire_date;
    NEW.status := OLD.status;
    NEW.email := OLD.email;
    NEW.contract_type := OLD.contract_type;
    NEW.contract_end_date := OLD.contract_end_date;
    NEW.basic_salary := OLD.basic_salary;
    NEW.iban := OLD.iban;
    NEW.notes := OLD.notes;
    NEW.device_user_id := OLD.device_user_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_employee_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employees_guard_self_update ON public.employees;
CREATE TRIGGER employees_guard_self_update
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.guard_employee_self_update();

DROP POLICY IF EXISTS employees_self_update ON public.employees;
CREATE POLICY employees_self_update ON public.employees
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());