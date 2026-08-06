
-- employees: allow HR full write alongside director
DROP POLICY IF EXISTS employees_write ON public.employees;
CREATE POLICY employees_write ON public.employees FOR ALL TO authenticated
USING (private.is_director() OR private.is_hr())
WITH CHECK (private.is_director() OR private.is_hr());

-- employee documents: allow HR full write alongside director
DROP POLICY IF EXISTS employee_documents_write ON public.employee_documents;
CREATE POLICY employee_documents_write ON public.employee_documents FOR ALL TO authenticated
USING (private.is_director() OR private.is_hr())
WITH CHECK (private.is_director() OR private.is_hr());

-- lifecycle events: full manage for HR/director
DROP POLICY IF EXISTS lifecycle_manage ON public.employee_lifecycle_events;
CREATE POLICY lifecycle_manage ON public.employee_lifecycle_events FOR ALL TO authenticated
USING (private.is_hr() OR private.is_director())
WITH CHECK (private.is_hr() OR private.is_director());

-- lifecycle checklist templates: full manage for HR/director
DROP POLICY IF EXISTS tpl_manage ON public.lifecycle_checklist_templates;
CREATE POLICY tpl_manage ON public.lifecycle_checklist_templates FOR ALL TO authenticated
USING (private.is_hr() OR private.is_director())
WITH CHECK (private.is_hr() OR private.is_director());

-- lifecycle checklist items: full manage for HR/director
DROP POLICY IF EXISTS chk_manage ON public.lifecycle_checklist_items;
CREATE POLICY chk_manage ON public.lifecycle_checklist_items FOR ALL TO authenticated
USING (private.is_hr() OR private.is_director())
WITH CHECK (private.is_hr() OR private.is_director());
