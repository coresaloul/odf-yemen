
-- ===== أنواع =====
DO $$ BEGIN
  CREATE TYPE public.custody_kind AS ENUM ('asset','vehicle','document','cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.custody_asset_status AS ENUM ('available','assigned','maintenance','damaged','written_off','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.custody_assignment_status AS ENUM ('draft','pending_manager','pending_hr','pending_director','approved','handed_over','returned','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== التصنيفات =====
CREATE TABLE IF NOT EXISTS public.custody_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.custody_kind NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_categories TO authenticated;
GRANT ALL ON public.custody_categories TO service_role;
ALTER TABLE public.custody_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_cat_select ON public.custody_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY cust_cat_manage ON public.custody_categories FOR ALL TO authenticated
  USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_cust_cat_updated BEFORE UPDATE ON public.custody_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== سجل الأصول =====
CREATE TABLE IF NOT EXISTS public.custody_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.custody_kind NOT NULL DEFAULT 'asset',
  category_id uuid REFERENCES public.custody_categories(id) ON DELETE SET NULL,
  status public.custody_asset_status NOT NULL DEFAULT 'available',
  serial_no text,
  brand text,
  model text,
  purchase_date date,
  value numeric(14,2) NOT NULL DEFAULT 0,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  location text,
  -- مركبات
  plate_no text,
  manufacture_year int,
  insurance_expiry date,
  license_expiry date,
  odometer int,
  -- وثائق وبطاقات
  document_no text,
  document_expiry date,
  photo_path text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_assets TO authenticated;
GRANT ALL ON public.custody_assets TO service_role;
ALTER TABLE public.custody_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_asset_select ON public.custody_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY cust_asset_manage ON public.custody_assets FOR ALL TO authenticated
  USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_cust_asset_updated BEFORE UPDATE ON public.custody_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== التسليمات =====
CREATE TABLE IF NOT EXISTS public.custody_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind public.custody_kind NOT NULL DEFAULT 'asset',
  status public.custody_assignment_status NOT NULL DEFAULT 'draft',
  purpose text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expected_return_date date,
  handed_over_at timestamptz,
  returned_at timestamptz,
  -- العهدة المالية
  cash_amount numeric(14,2) NOT NULL DEFAULT 0,
  cash_settled numeric(14,2) NOT NULL DEFAULT 0,
  acknowledged_at timestamptz,
  receipt_path text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_assignments TO authenticated;
GRANT ALL ON public.custody_assignments TO service_role;
ALTER TABLE public.custody_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_asg_select ON public.custody_assignments FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.can_supervise(employee_id) OR private.is_hr() OR private.is_director());
CREATE POLICY cust_asg_insert ON public.custody_assignments FOR INSERT TO authenticated
  WITH CHECK (private.is_self_employee(employee_id) OR private.can_supervise(employee_id) OR private.is_hr() OR private.is_director());
CREATE POLICY cust_asg_update ON public.custody_assignments FOR UPDATE TO authenticated
  USING (private.can_supervise(employee_id) OR private.is_hr() OR private.is_director())
  WITH CHECK (private.can_supervise(employee_id) OR private.is_hr() OR private.is_director());
CREATE POLICY cust_asg_delete ON public.custody_assignments FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_cust_asg_updated BEFORE UPDATE ON public.custody_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== بنود التسليم =====
CREATE TABLE IF NOT EXISTS public.custody_assignment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.custody_assignments(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.custody_assets(id) ON DELETE SET NULL,
  title text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  condition_out text,
  condition_in text,
  odometer_out int,
  odometer_in int,
  returned_at timestamptz,
  return_state text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_assignment_items TO authenticated;
GRANT ALL ON public.custody_assignment_items TO service_role;
ALTER TABLE public.custody_assignment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_item_select ON public.custody_assignment_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.custody_assignments a WHERE a.id = assignment_id
    AND (private.is_self_employee(a.employee_id) OR private.can_supervise(a.employee_id) OR private.is_hr() OR private.is_director())));
CREATE POLICY cust_item_manage ON public.custody_assignment_items FOR ALL TO authenticated
  USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_cust_item_updated BEFORE UPDATE ON public.custody_assignment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== مراحل الاعتماد =====
CREATE TABLE IF NOT EXISTS public.custody_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.custody_assignments(id) ON DELETE CASCADE,
  stage text NOT NULL,
  decision text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.custody_approvals TO authenticated;
GRANT ALL ON public.custody_approvals TO service_role;
ALTER TABLE public.custody_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_appr_select ON public.custody_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.custody_assignments a WHERE a.id = assignment_id
    AND (private.is_self_employee(a.employee_id) OR private.can_supervise(a.employee_id) OR private.is_hr() OR private.is_director())));

-- ===== حركات العهدة المالية =====
CREATE TABLE IF NOT EXISTS public.custody_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.custody_assignments(id) ON DELETE CASCADE,
  tx_date date NOT NULL DEFAULT CURRENT_DATE,
  tx_type text NOT NULL DEFAULT 'expense',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  attachment_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_transactions TO authenticated;
GRANT ALL ON public.custody_transactions TO service_role;
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_tx_select ON public.custody_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.custody_assignments a WHERE a.id = assignment_id
    AND (private.is_self_employee(a.employee_id) OR private.can_supervise(a.employee_id) OR private.is_hr() OR private.is_director())));
CREATE POLICY cust_tx_manage ON public.custody_transactions FOR ALL TO authenticated
  USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_cust_tx_updated BEFORE UPDATE ON public.custody_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cust_asg_emp ON public.custody_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_cust_item_asg ON public.custody_assignment_items(assignment_id);

-- ===== تصنيفات افتراضية =====
INSERT INTO public.custody_categories (name, kind, description) VALUES
  ('أجهزة حاسوب', 'asset', 'لابتوب، حاسب مكتبي، شاشات'),
  ('هواتف وأجهزة اتصال', 'asset', 'هواتف ذكية وأجهزة لاسلكي'),
  ('أثاث ومعدات مكتبية', 'asset', 'مكاتب، كراسي، طابعات'),
  ('مركبات', 'vehicle', 'سيارات ودراجات المؤسسة'),
  ('بطاقات ووثائق', 'document', 'بطاقة تعريف، شريحة اتصال، بطاقة وقود، مفاتيح'),
  ('عهدة مالية', 'cash', 'سلف تشغيلية نقدية')
ON CONFLICT DO NOTHING;
