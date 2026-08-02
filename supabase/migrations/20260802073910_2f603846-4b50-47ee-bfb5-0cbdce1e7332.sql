-- ═══════════ إعدادات الرواتب ═══════════
CREATE TABLE public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL DEFAULT 'YER',
  month_days integer NOT NULL DEFAULT 30,
  day_hours numeric NOT NULL DEFAULT 8,
  deduct_absence boolean NOT NULL DEFAULT true,
  deduct_unpaid_leave boolean NOT NULL DEFAULT true,
  deduct_late boolean NOT NULL DEFAULT true,
  late_grace_minutes integer NOT NULL DEFAULT 0,
  incentive_tiers jsonb NOT NULL DEFAULT '[{"min_score":90,"percent":10},{"min_score":80,"percent":5},{"min_score":70,"percent":2}]'::jsonb,
  manager_can_view boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_settings TO authenticated;
GRANT ALL ON public.payroll_settings TO service_role;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_settings_select ON public.payroll_settings FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director());
CREATE POLICY payroll_settings_write ON public.payroll_settings FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_payroll_settings_updated BEFORE UPDATE ON public.payroll_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.payroll_settings DEFAULT VALUES;

-- ═══════════ بنود البدلات والاستقطاعات ═══════════
CREATE TABLE public.payroll_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('earning','deduction')),
  calc_method text NOT NULL DEFAULT 'fixed' CHECK (calc_method IN ('fixed','percent_basic')),
  default_amount numeric NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_components TO authenticated;
GRANT ALL ON public.payroll_components TO service_role;
ALTER TABLE public.payroll_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_components_select ON public.payroll_components FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director());
CREATE POLICY payroll_components_write ON public.payroll_components FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_payroll_components_updated BEFORE UPDATE ON public.payroll_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payroll_components (name, kind, calc_method, default_amount, sort_order) VALUES
  ('بدل سكن','earning','percent_basic',20,1),
  ('بدل مواصلات','earning','fixed',0,2),
  ('بدل اتصالات','earning','fixed',0,3),
  ('بدل طبيعة عمل','earning','fixed',0,4),
  ('تأمين صحي','deduction','fixed',0,10),
  ('ضريبة دخل','deduction','percent_basic',0,11),
  ('استقطاع أخرى','deduction','fixed',0,12);

-- ═══════════ ملف الأجر لكل موظف ═══════════
CREATE TABLE public.employee_payroll_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  worker_type text NOT NULL DEFAULT 'employee' CHECK (worker_type IN ('employee','worker','consultant','volunteer')),
  basic_salary numeric NOT NULL DEFAULT 0,
  daily_rate numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  stipend numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'bank' CHECK (payment_method IN ('cash','transfer','bank')),
  bank_name text,
  account_no text,
  iban text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_payroll_profiles TO authenticated;
GRANT ALL ON public.employee_payroll_profiles TO service_role;
ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY epp_select ON public.employee_payroll_profiles FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director() OR private.is_self_employee(employee_id));
CREATE POLICY epp_write ON public.employee_payroll_profiles FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_epp_updated BEFORE UPDATE ON public.employee_payroll_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════ بنود الموظف ═══════════
CREATE TABLE public.employee_payroll_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.payroll_components(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epc_employee ON public.employee_payroll_components(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_payroll_components TO authenticated;
GRANT ALL ON public.employee_payroll_components TO service_role;
ALTER TABLE public.employee_payroll_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY epc_select ON public.employee_payroll_components FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director() OR private.is_self_employee(employee_id));
CREATE POLICY epc_write ON public.employee_payroll_components FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_epc_updated BEFORE UPDATE ON public.employee_payroll_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════ دورات الرواتب ═══════════
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  title text,
  categories text[] NOT NULL DEFAULT ARRAY['employee','worker','consultant','volunteer'],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','hr_review','director_review','approved','paid')),
  total_earnings numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  return_reason text,
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  director_approved_by uuid,
  director_approved_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_runs_select ON public.payroll_runs FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director());
CREATE POLICY payroll_runs_write ON public.payroll_runs FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  department_name text,
  worker_type text NOT NULL DEFAULT 'employee',
  basic_amount numeric NOT NULL DEFAULT 0,
  gross_earnings numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  days_present integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  paid_leave_days numeric NOT NULL DEFAULT 0,
  unpaid_leave_days numeric NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  worked_hours numeric NOT NULL DEFAULT 0,
  payment_method text,
  iban text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id)
);
CREATE INDEX idx_payroll_items_employee ON public.payroll_items(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_items_select ON public.payroll_items FOR SELECT TO authenticated USING (
  private.is_hr() OR private.is_director() OR (
    private.is_self_employee(employee_id)
    AND EXISTS (SELECT 1 FROM public.payroll_runs r WHERE r.id = run_id AND r.status IN ('approved','paid'))
  )
);
CREATE POLICY payroll_items_write ON public.payroll_items FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_payroll_items_updated BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_item_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  line_type text NOT NULL CHECK (line_type IN ('earning','deduction')),
  source text NOT NULL CHECK (source IN ('basic','component','attendance','incentive','advance','adjustment','contract','manual')),
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_lines_item ON public.payroll_item_lines(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_item_lines TO authenticated;
GRANT ALL ON public.payroll_item_lines TO service_role;
ALTER TABLE public.payroll_item_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_lines_select ON public.payroll_item_lines FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.payroll_items i WHERE i.id = item_id)
);
CREATE POLICY payroll_lines_write ON public.payroll_item_lines FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());

CREATE TABLE public.payroll_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payroll_approvals TO authenticated;
GRANT ALL ON public.payroll_approvals TO service_role;
ALTER TABLE public.payroll_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_approvals_select ON public.payroll_approvals FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director());

-- ═══════════ التعديلات على الرواتب ═══════════
CREATE TABLE public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  original_month date,
  kind text NOT NULL CHECK (kind IN ('addition','deduction')),
  reason_type text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  attachment_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','locked','applied')),
  run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_adjustments_month ON public.payroll_adjustments(target_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_adjustments TO authenticated;
GRANT ALL ON public.payroll_adjustments TO service_role;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_adj_select ON public.payroll_adjustments FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director() OR private.is_self_employee(employee_id));
CREATE POLICY payroll_adj_write ON public.payroll_adjustments FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_payroll_adj_updated BEFORE UPDATE ON public.payroll_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════ السلف ═══════════
CREATE TABLE public.employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL DEFAULT 0,
  installment_amount numeric NOT NULL DEFAULT 0,
  installments_count integer NOT NULL DEFAULT 1,
  paid_amount numeric NOT NULL DEFAULT 0,
  start_month date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','cancelled')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_advances_employee ON public.employee_advances(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_advances TO authenticated;
GRANT ALL ON public.employee_advances TO service_role;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY advances_select ON public.employee_advances FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director() OR private.is_self_employee(employee_id));
CREATE POLICY advances_write ON public.employee_advances FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_advances_updated BEFORE UPDATE ON public.employee_advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════ عقود الاستشاريين ═══════════
CREATE TABLE public.consultant_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_contracts TO authenticated;
GRANT ALL ON public.consultant_contracts TO service_role;
ALTER TABLE public.consultant_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracts_select ON public.consultant_contracts FOR SELECT TO authenticated USING (private.is_hr() OR private.is_director() OR private.is_self_employee(employee_id));
CREATE POLICY contracts_write ON public.consultant_contracts FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.consultant_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contract_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.consultant_contracts(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_installments_contract ON public.contract_installments(contract_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_installments TO authenticated;
GRANT ALL ON public.contract_installments TO service_role;
ALTER TABLE public.contract_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY installments_select ON public.contract_installments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.consultant_contracts c WHERE c.id = contract_id)
);
CREATE POLICY installments_write ON public.contract_installments FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_installments_updated BEFORE UPDATE ON public.contract_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();