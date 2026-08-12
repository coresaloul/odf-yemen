CREATE OR REPLACE FUNCTION private.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    NEW.probation_start := OLD.probation_start;
    NEW.probation_end := OLD.probation_end;
    NEW.probation_status := OLD.probation_status;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS task_files_update ON storage.objects;
CREATE POLICY task_files_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'task-files' AND owner = auth.uid())
WITH CHECK (bucket_id = 'task-files' AND owner = auth.uid());
