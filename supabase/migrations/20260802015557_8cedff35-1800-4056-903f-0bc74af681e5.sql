ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS chronic_diseases text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS national_id_expiry date,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS passport_expiry date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS basic_salary numeric,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'certificate',
  title text NOT NULL,
  issuer text,
  doc_number text,
  issue_date date,
  expiry_date date,
  file_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_documents_select" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (public.is_self_employee(employee_id) OR public.can_supervise(employee_id) OR public.is_hr());

CREATE POLICY "employee_documents_write" ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

CREATE INDEX IF NOT EXISTS employee_documents_employee_id_idx ON public.employee_documents(employee_id);

CREATE TRIGGER update_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();