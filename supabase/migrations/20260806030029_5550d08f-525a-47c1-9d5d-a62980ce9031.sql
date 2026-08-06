
-- ===== أنواع التكريم والجزاءات =====
CREATE TABLE public.disciplinary_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('recognition','sanction')),
  degree integer NOT NULL DEFAULT 0,
  description text,
  max_days numeric NOT NULL DEFAULT 0,
  requires_amount boolean NOT NULL DEFAULT false,
  erase_months integer NOT NULL DEFAULT 6,
  approval_flow text[] NOT NULL DEFAULT ARRAY['manager','hr','director'],
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.disciplinary_types TO authenticated;
GRANT ALL ON public.disciplinary_types TO service_role;
ALTER TABLE public.disciplinary_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types_read" ON public.disciplinary_types FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_disc_types_updated BEFORE UPDATE ON public.disciplinary_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== التكريمات =====
CREATE TABLE public.employee_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.disciplinary_types(id),
  title text NOT NULL,
  reason text,
  award_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  target_month date,
  attachment_url text,
  stage approval_stage NOT NULL DEFAULT 'draft',
  return_reason text,
  submitted_at timestamptz,
  manager_approved_by uuid,
  manager_approved_at timestamptz,
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  director_approved_by uuid,
  director_approved_at timestamptz,
  payroll_adjustment_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_recognitions TO authenticated;
GRANT ALL ON public.employee_recognitions TO service_role;
ALTER TABLE public.employee_recognitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recog_select" ON public.employee_recognitions FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "recog_write" ON public.employee_recognitions FOR INSERT TO authenticated
  WITH CHECK (private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "recog_update" ON public.employee_recognitions FOR UPDATE TO authenticated
  USING (private.is_hr() OR private.is_director() OR private.can_supervise(employee_id))
  WITH CHECK (private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "recog_delete" ON public.employee_recognitions FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_recog_updated BEFORE UPDATE ON public.employee_recognitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== الجزاءات التأديبية =====
CREATE TABLE public.disciplinary_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.disciplinary_types(id),
  violation_date date NOT NULL,
  discovered_date date NOT NULL DEFAULT CURRENT_DATE,
  violation_description text NOT NULL,
  employee_statement text,
  statement_date date,
  penalty_days numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  target_month date,
  attachment_url text,
  stage approval_stage NOT NULL DEFAULT 'draft',
  return_reason text,
  submitted_at timestamptz,
  manager_approved_by uuid,
  manager_approved_at timestamptz,
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  director_approved_by uuid,
  director_approved_at timestamptz,
  erase_at date,
  erased boolean NOT NULL DEFAULT false,
  appeal_note text,
  appeal_at timestamptz,
  appeal_status text NOT NULL DEFAULT 'none' CHECK (appeal_status IN ('none','submitted','accepted','rejected')),
  appeal_decision_note text,
  appeal_decided_by uuid,
  appeal_decided_at timestamptz,
  payroll_adjustment_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary_actions TO authenticated;
GRANT ALL ON public.disciplinary_actions TO service_role;
ALTER TABLE public.disciplinary_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_select" ON public.disciplinary_actions FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "disc_insert" ON public.disciplinary_actions FOR INSERT TO authenticated
  WITH CHECK (private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "disc_update" ON public.disciplinary_actions FOR UPDATE TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id))
  WITH CHECK (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "disc_delete" ON public.disciplinary_actions FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_disc_updated BEFORE UPDATE ON public.disciplinary_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== سجل قرارات الاعتماد =====
CREATE TABLE public.discipline_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind text NOT NULL CHECK (record_kind IN ('recognition','sanction')),
  record_id uuid NOT NULL,
  stage approval_stage NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discipline_approvals TO authenticated;
GRANT ALL ON public.discipline_approvals TO service_role;
ALTER TABLE public.discipline_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_appr_select" ON public.discipline_approvals FOR SELECT TO authenticated
  USING (private.is_hr() OR private.is_director());

-- ===== دورة حياة الموظف: الأحداث =====
CREATE TABLE public.employee_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  details text,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  ref_table text,
  ref_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lifecycle_employee ON public.employee_lifecycle_events(employee_id, event_date DESC);
GRANT SELECT ON public.employee_lifecycle_events TO authenticated;
GRANT ALL ON public.employee_lifecycle_events TO service_role;
ALTER TABLE public.employee_lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lifecycle_select" ON public.employee_lifecycle_events FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));

-- ===== قوالب التهيئة وإخلاء الطرف =====
CREATE TABLE public.lifecycle_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('onboarding','offboarding')),
  title text NOT NULL,
  owner_role text NOT NULL DEFAULT 'hr',
  offset_days integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lifecycle_checklist_templates TO authenticated;
GRANT ALL ON public.lifecycle_checklist_templates TO service_role;
ALTER TABLE public.lifecycle_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl_select" ON public.lifecycle_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_tpl_updated BEFORE UPDATE ON public.lifecycle_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lifecycle_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('onboarding','offboarding')),
  title text NOT NULL,
  owner_role text NOT NULL DEFAULT 'hr',
  due_date date,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_employee ON public.lifecycle_checklist_items(employee_id, kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifecycle_checklist_items TO authenticated;
GRANT ALL ON public.lifecycle_checklist_items TO service_role;
ALTER TABLE public.lifecycle_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chk_select" ON public.lifecycle_checklist_items FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "chk_update" ON public.lifecycle_checklist_items FOR UPDATE TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id))
  WITH CHECK (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "chk_insert" ON public.lifecycle_checklist_items FOR INSERT TO authenticated
  WITH CHECK (private.is_hr() OR private.is_director());
CREATE POLICY "chk_delete" ON public.lifecycle_checklist_items FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_chk_updated BEFORE UPDATE ON public.lifecycle_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== الحركات الوظيفية =====
CREATE TABLE public.employment_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  effective_date date NOT NULL,
  from_value text,
  to_value text,
  note text,
  attachment_url text,
  applied boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_employee ON public.employment_movements(employee_id, effective_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employment_movements TO authenticated;
GRANT ALL ON public.employment_movements TO service_role;
ALTER TABLE public.employment_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_select" ON public.employment_movements FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "mov_insert" ON public.employment_movements FOR INSERT TO authenticated
  WITH CHECK (private.is_hr() OR private.is_director());
CREATE POLICY "mov_update" ON public.employment_movements FOR UPDATE TO authenticated
  USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE POLICY "mov_delete" ON public.employment_movements FOR DELETE TO authenticated
  USING (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_mov_updated BEFORE UPDATE ON public.employment_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== نهاية الخدمة =====
CREATE TABLE public.employee_offboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  termination_type text NOT NULL,
  notice_date date,
  last_working_day date NOT NULL,
  reason text,
  settlement_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_offboarding TO authenticated;
GRANT ALL ON public.employee_offboarding TO service_role;
ALTER TABLE public.employee_offboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "off_select" ON public.employee_offboarding FOR SELECT TO authenticated
  USING (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director() OR private.can_supervise(employee_id));
CREATE POLICY "off_manage" ON public.employee_offboarding FOR ALL TO authenticated
  USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director());
CREATE TRIGGER trg_off_updated BEFORE UPDATE ON public.employee_offboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== فترة التجربة على ملف الموظف =====
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS probation_start date,
  ADD COLUMN IF NOT EXISTS probation_end date,
  ADD COLUMN IF NOT EXISTS probation_status text NOT NULL DEFAULT 'not_applicable';

-- ===== بيانات الكتالوج =====
INSERT INTO public.disciplinary_types (code, name, kind, degree, description, max_days, requires_amount, erase_months, approval_flow, sort_order) VALUES
('verbal_notice','تنبيه شفهي موثّق','sanction',1,'أول درجات التدرج التأديبي، يُوثَّق في ملف الموظف',0,false,6,ARRAY['manager','hr'],1),
('written_warning_1','إنذار كتابي أول','sanction',2,'إنذار كتابي بعد التنبيه الشفهي',0,false,6,ARRAY['manager','hr'],2),
('written_warning_2','إنذار كتابي ثاني (نهائي)','sanction',3,'إنذار نهائي قبل الجزاءات المادية',0,false,12,ARRAY['manager','hr','director'],3),
('wage_deduction','خصم من الأجر','sanction',4,'بحد أقصى أجر ثلاثة أيام عن المخالفة الواحدة وبما لا يتجاوز أجر خمسة أيام شهرياً',3,true,12,ARRAY['manager','hr','director'],4),
('bonus_denial','الحرمان من العلاوة أو تأجيل الترقية','sanction',5,'حرمان من علاوة دورية أو تأجيل ترقية',0,false,12,ARRAY['manager','hr','director'],5),
('suspension','الإيقاف عن العمل مؤقتاً','sanction',6,'إيقاف مؤقت بما لا يتجاوز أجر خمسة أيام',5,true,12,ARRAY['manager','hr','director'],6),
('dismissal','الفصل التأديبي','sanction',7,'للحالات المنصوص عليها في قانون العمل',0,false,0,ARRAY['manager','hr','director'],7),
('thanks_letter','شهادة/خطاب شكر','recognition',0,'تقدير كتابي على أداء متميز',0,false,0,ARRAY['manager','hr'],11),
('employee_of_month','موظف الشهر/الربع','recognition',0,'تكريم دوري لأفضل أداء',0,false,0,ARRAY['manager','hr','director'],12),
('cash_bonus','مكافأة مالية','recognition',0,'مكافأة مالية تُصرف ضمن راتب الشهر المحدد',0,true,0,ARRAY['manager','hr','director'],13),
('exceptional_promotion','ترقية استثنائية','recognition',0,'ترقية خارج الدورة العادية لأداء استثنائي',0,false,0,ARRAY['manager','hr','director'],14),
('appreciation_award','درع/جائزة تقدير','recognition',0,'تكريم معنوي في المناسبات المؤسسية',0,false,0,ARRAY['manager','hr'],15);

INSERT INTO public.lifecycle_checklist_templates (kind, title, owner_role, offset_days, sort_order) VALUES
('onboarding','توقيع عقد العمل وحفظ نسخة في الملف','hr',0,1),
('onboarding','فتح حساب مستخدم في النظام وتسليم بيانات الدخول','hr',1,2),
('onboarding','تسليم العهدة (حاسوب، هاتف، بطاقة تعريف)','hr',1,3),
('onboarding','تسجيل بصمة الحضور وربطها بالملف','hr',1,4),
('onboarding','التعريف باللوائح والسياسات وميثاق السلوك','hr',3,5),
('onboarding','جلسة تعريفية بالإدارة وفريق العمل','manager',3,6),
('onboarding','تحديد الوصف الوظيفي وأهداف فترة التجربة','manager',7,7),
('onboarding','فتح الحساب البنكي وتزويد بيانات الراتب','hr',7,8),
('offboarding','استلام خطاب الاستقالة/قرار إنهاء الخدمة','hr',0,1),
('offboarding','تسليم المهام والملفات للبديل','manager',0,2),
('offboarding','إعادة العهدة (حاسوب، هاتف، بطاقة، مفاتيح)','hr',0,3),
('offboarding','تسوية السلف والمستحقات المالية','hr',0,4),
('offboarding','إيقاف حساب المستخدم وصلاحيات الأنظمة','hr',0,5),
('offboarding','إصدار مخالصة نهاية الخدمة وشهادة الخبرة','hr',0,6);
