-- 1. CRITERIA TEMPLATES
CREATE TABLE public.evaluation_criteria_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'behavior' CHECK (kind IN ('tasks','attendance','behavior')),
  weight numeric(5,2) NOT NULL DEFAULT 10,
  max_score numeric(5,2) NOT NULL DEFAULT 100,
  applies_periods text[] NOT NULL DEFAULT ARRAY['monthly','quarterly','semiannual','annual'],
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_criteria_templates TO authenticated;
GRANT ALL ON public.evaluation_criteria_templates TO service_role;
ALTER TABLE public.evaluation_criteria_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "criteria_templates_select" ON public.evaluation_criteria_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "criteria_templates_write" ON public.evaluation_criteria_templates
  FOR ALL TO authenticated
  USING (private.is_director() OR private.is_hr())
  WITH CHECK (private.is_director() OR private.is_hr());

CREATE TRIGGER trg_criteria_templates_updated BEFORE UPDATE ON public.evaluation_criteria_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. EVALUATION CRITERIA DETAIL
ALTER TABLE public.evaluation_criteria
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.evaluation_criteria_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'behavior',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS max_score numeric(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS details jsonb;

-- 3. SELF ASSESSMENTS
CREATE TABLE public.evaluation_self_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period public.period_type NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  achievements text,
  challenges text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_self_assessments TO authenticated;
GRANT ALL ON public.evaluation_self_assessments TO service_role;
ALTER TABLE public.evaluation_self_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_assessment_select" ON public.evaluation_self_assessments
  FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.can_supervise(employee_id) OR private.is_hr());
CREATE POLICY "self_assessment_write" ON public.evaluation_self_assessments
  FOR ALL TO authenticated
  USING (private.is_self_employee(employee_id))
  WITH CHECK (private.is_self_employee(employee_id));

CREATE TRIGGER trg_self_assessments_updated BEFORE UPDATE ON public.evaluation_self_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. GOALS / IMPROVEMENT PLAN
CREATE TABLE public.evaluation_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  title text NOT NULL,
  metric text,
  target_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','achieved','missed')),
  achievement_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_goals TO authenticated;
GRANT ALL ON public.evaluation_goals TO service_role;
ALTER TABLE public.evaluation_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluation_goals_select" ON public.evaluation_goals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id
    AND (private.is_self_employee(e.employee_id) OR private.can_supervise(e.employee_id) OR private.is_hr())));
CREATE POLICY "evaluation_goals_write" ON public.evaluation_goals
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND private.can_supervise(e.employee_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id AND private.can_supervise(e.employee_id)));

CREATE TRIGGER trg_evaluation_goals_updated BEFORE UPDATE ON public.evaluation_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ACKNOWLEDGEMENT ON EVALUATIONS
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS acknowledgement_status text NOT NULL DEFAULT 'pending'
    CHECK (acknowledgement_status IN ('pending','acknowledged','disputed')),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledgement_note text,
  ADD COLUMN IF NOT EXISTS strengths text,
  ADD COLUMN IF NOT EXISTS improvements text;

DROP POLICY IF EXISTS "employee_acknowledge_own_evaluation" ON public.evaluations;
CREATE POLICY "employee_acknowledge_own_evaluation" ON public.evaluations
  FOR UPDATE TO authenticated
  USING (private.is_self_employee(employee_id) AND approval_stage = 'approved')
  WITH CHECK (private.is_self_employee(employee_id) AND approval_stage = 'approved');

-- 6. ONE EVALUATION PER EMPLOYEE PER PERIOD
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_employee_period_unique
  ON public.evaluations (employee_id, period, period_start);

-- 7. DEFAULT CRITERIA
INSERT INTO public.evaluation_criteria_templates (name, description, kind, weight, sort_order) VALUES
  ('إنجاز المهام', 'يُحتسب تلقائياً من نسب إنجاز مهام الموظف خلال الفترة مع خصم للتأخر عن المواعيد', 'tasks', 50, 1),
  ('الالتزام بالدوام', 'يُحتسب تلقائياً من سجلات الحضور خلال الفترة (الحضور، التأخير، الخروج المبكر، الغياب)', 'attendance', 30, 2),
  ('جودة العمل', 'دقة المخرجات ومطابقتها للمعايير المطلوبة', 'behavior', 5, 3),
  ('التعاون والعمل الجماعي', 'التفاعل مع الزملاء ودعم فريق العمل', 'behavior', 4, 4),
  ('المبادرة والتطوير', 'تقديم الأفكار وتطوير أساليب العمل', 'behavior', 4, 5),
  ('الالتزام بقيم المؤسسة', 'الالتزام بالسياسات والسلوك المهني وقيم المؤسسة', 'behavior', 4, 6),
  ('الانضباط السلوكي', 'الالتزام بالتعليمات وحسن التعامل داخل بيئة العمل', 'behavior', 3, 7);