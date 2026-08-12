-- biometric_devices: explicit write restrictions (HR/director only)
CREATE POLICY "hr_director_insert_devices" ON public.biometric_devices
  FOR INSERT TO authenticated
  WITH CHECK (private.is_hr() OR private.is_director());

CREATE POLICY "hr_director_update_devices" ON public.biometric_devices
  FOR UPDATE TO authenticated
  USING (private.is_hr() OR private.is_director())
  WITH CHECK (private.is_hr() OR private.is_director());

CREATE POLICY "hr_director_delete_devices" ON public.biometric_devices
  FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());

-- biometric_punches: ingestion is service-role only; no client writes/updates
CREATE POLICY "no_client_insert_punches" ON public.biometric_punches
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "no_client_update_punches" ON public.biometric_punches
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "hr_director_delete_punches" ON public.biometric_punches
  FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());

-- custody_assignments: employees may only create their own DRAFT requests
DROP POLICY IF EXISTS "cust_asg_insert" ON public.custody_assignments;
CREATE POLICY "cust_asg_insert" ON public.custody_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_supervise(employee_id)
    OR private.is_hr()
    OR private.is_director()
    OR (private.is_self_employee(employee_id) AND status = 'draft'::custody_assignment_status)
  );