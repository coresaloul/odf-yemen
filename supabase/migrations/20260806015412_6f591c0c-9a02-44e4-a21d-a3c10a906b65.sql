CREATE TABLE public.hr_request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_flow text[] NOT NULL DEFAULT ARRAY['manager','hr'],
  is_confidential boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hr_request_types TO authenticated;
GRANT ALL ON public.hr_request_types TO service_role;
ALTER TABLE public.hr_request_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_request_types_select" ON public.hr_request_types
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.hr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.hr_request_types(id),
  title text NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_requests TO authenticated;
GRANT ALL ON public.hr_requests TO service_role;
ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_requests_select" ON public.hr_requests
  FOR SELECT TO authenticated
  USING (
    private.is_self_employee(employee_id)
    OR private.can_supervise(employee_id)
    OR private.is_hr()
    OR private.is_director()
  );
CREATE POLICY "hr_requests_insert" ON public.hr_requests
  FOR INSERT TO authenticated
  WITH CHECK (private.is_self_employee(employee_id) OR private.is_hr() OR private.is_director());
CREATE POLICY "hr_requests_update_own_draft" ON public.hr_requests
  FOR UPDATE TO authenticated
  USING (
    private.is_self_employee(employee_id)
    AND stage IN ('draft','returned')
  )
  WITH CHECK (private.is_self_employee(employee_id));
CREATE POLICY "hr_requests_delete_own_draft" ON public.hr_requests
  FOR DELETE TO authenticated
  USING (
    private.is_self_employee(employee_id)
    AND stage IN ('draft','returned')
  );

CREATE TRIGGER trg_hr_request_types_updated BEFORE UPDATE ON public.hr_request_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_requests_updated BEFORE UPDATE ON public.hr_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hr_request_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.hr_requests(id) ON DELETE CASCADE,
  stage approval_stage NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hr_request_approvals TO authenticated;
GRANT ALL ON public.hr_request_approvals TO service_role;
ALTER TABLE public.hr_request_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_request_approvals_select" ON public.hr_request_approvals
  FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT r.id FROM public.hr_requests r
      WHERE private.is_self_employee(r.employee_id)
         OR private.can_supervise(r.employee_id)
    )
    OR private.is_hr()
    OR private.is_director()
  );

CREATE INDEX idx_hr_requests_employee ON public.hr_requests(employee_id);
CREATE INDEX idx_hr_requests_stage ON public.hr_requests(stage);

INSERT INTO public.hr_request_types (code, name, category, fields, approval_flow, is_confidential, sort_order) VALUES
('maintenance','طلب صيانة','الخدمات والتشغيل','[{"key":"location","label":"الموقع","type":"text","required":true},{"key":"issue_type","label":"نوع العطل","type":"select","required":true,"options":["كهرباء","سباكة","أثاث","تكييف","شبكة وحاسوب","أخرى"]},{"key":"priority","label":"الأولوية","type":"select","required":true,"options":["عادي","عاجل","طارئ"]},{"key":"details","label":"وصف المشكلة","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr'], false, 10),
('office_supplies','طلب لوازم مكتبية','الخدمات والتشغيل','[{"key":"items","label":"الأصناف المطلوبة","type":"textarea","required":true},{"key":"quantity","label":"الكمية الإجمالية","type":"number"},{"key":"needed_by","label":"مطلوب قبل تاريخ","type":"date"},{"key":"purpose","label":"الغرض","type":"textarea"}]'::jsonb, ARRAY['manager','hr'], false, 20),
('asset_request','طلب عهدة / جهاز','الخدمات والتشغيل','[{"key":"asset","label":"الجهاز أو العهدة","type":"text","required":true},{"key":"reason","label":"سبب الطلب","type":"textarea","required":true},{"key":"period","label":"مدة الاستخدام","type":"text"}]'::jsonb, ARRAY['manager','hr'], false, 30),
('asset_return','طلب تسليم عهدة','الخدمات والتشغيل','[{"key":"asset","label":"العهدة المراد تسليمها","type":"text","required":true},{"key":"condition","label":"حالة العهدة","type":"select","options":["ممتازة","جيدة","تالفة"]},{"key":"notes","label":"ملاحظات","type":"textarea"}]'::jsonb, ARRAY['manager','hr'], false, 40),
('vehicle','طلب سيارة / مواصلات','الخدمات والتشغيل','[{"key":"destination","label":"الوجهة","type":"text","required":true},{"key":"date","label":"التاريخ","type":"date","required":true},{"key":"from_time","label":"من الساعة","type":"time"},{"key":"to_time","label":"إلى الساعة","type":"time"},{"key":"passengers","label":"عدد الركاب","type":"number"},{"key":"purpose","label":"الغرض","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr'], false, 50),
('printing','طلب طباعة أو تصميم','الخدمات والتشغيل','[{"key":"item","label":"المطلوب","type":"text","required":true},{"key":"quantity","label":"العدد","type":"number"},{"key":"needed_by","label":"مطلوب قبل تاريخ","type":"date"},{"key":"details","label":"التفاصيل","type":"textarea"}]'::jsonb, ARRAY['manager','hr'], false, 60),
('it_support','طلب دعم تقني','الخدمات والتشغيل','[{"key":"system","label":"النظام أو الجهاز","type":"text","required":true},{"key":"problem","label":"وصف المشكلة","type":"textarea","required":true},{"key":"priority","label":"الأولوية","type":"select","options":["عادي","عاجل"]}]'::jsonb, ARRAY['manager','hr'], false, 70),
('field_mission','طلب مهمة خارجية ميدانية','العمل الميداني','[{"key":"entity","label":"الجهة / الموقع","type":"text","required":true},{"key":"date_from","label":"تاريخ الانطلاق","type":"date","required":true},{"key":"time_from","label":"وقت الانطلاق","type":"time"},{"key":"date_to","label":"تاريخ العودة","type":"date"},{"key":"time_to","label":"وقت العودة","type":"time"},{"key":"purpose","label":"الغرض من المهمة","type":"textarea","required":true},{"key":"transport","label":"وسيلة النقل","type":"select","options":["سيارة المؤسسة","سيارة خاصة","مواصلات عامة"]},{"key":"allowance","label":"يحتاج بدل مواصلات","type":"boolean"}]'::jsonb, ARRAY['manager','hr'], false, 80),
('travel','طلب سفر ومبيت','العمل الميداني','[{"key":"destination","label":"الوجهة","type":"text","required":true},{"key":"date_from","label":"من تاريخ","type":"date","required":true},{"key":"date_to","label":"إلى تاريخ","type":"date","required":true},{"key":"nights","label":"عدد ليالي المبيت","type":"number"},{"key":"purpose","label":"الغرض","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr','director'], false, 90),
('activity_coverage','طلب تغطية نشاط','العمل الميداني','[{"key":"activity","label":"اسم النشاط","type":"text","required":true},{"key":"date","label":"تاريخ النشاط","type":"date","required":true},{"key":"location","label":"المكان","type":"text"},{"key":"needs","label":"الاحتياجات","type":"textarea"}]'::jsonb, ARRAY['manager','hr'], false, 100),
('employment_letter','طلب شهادة تعريف / راتب','شؤون الموظفين','[{"key":"letter_type","label":"نوع الشهادة","type":"select","required":true,"options":["تعريف بالعمل","تعريف براتب","خبرة"]},{"key":"addressee","label":"موجّهة إلى","type":"text","required":true},{"key":"copies","label":"عدد النسخ","type":"number"}]'::jsonb, ARRAY['hr'], false, 110),
('data_update','طلب تعديل بيانات شخصية','شؤون الموظفين','[{"key":"field","label":"البيان المراد تعديله","type":"text","required":true},{"key":"new_value","label":"القيمة الجديدة","type":"text","required":true},{"key":"reason","label":"السبب","type":"textarea"}]'::jsonb, ARRAY['hr'], false, 120),
('transfer','طلب نقل بين إدارة أو قسم','شؤون الموظفين','[{"key":"target","label":"الإدارة أو القسم المطلوب","type":"text","required":true},{"key":"reason","label":"مبررات النقل","type":"textarea","required":true},{"key":"preferred_date","label":"التاريخ المقترح","type":"date"}]'::jsonb, ARRAY['manager','hr','director'], false, 130),
('title_change','طلب تغيير مسمى وظيفي','شؤون الموظفين','[{"key":"current_title","label":"المسمى الحالي","type":"text","required":true},{"key":"new_title","label":"المسمى المطلوب","type":"text","required":true},{"key":"justification","label":"المبررات","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr','director'], false, 140),
('contract_renewal','طلب تجديد عقد','شؤون الموظفين','[{"key":"current_end","label":"تاريخ انتهاء العقد الحالي","type":"date","required":true},{"key":"requested_period","label":"مدة التجديد المطلوبة","type":"text"},{"key":"notes","label":"ملاحظات","type":"textarea"}]'::jsonb, ARRAY['manager','hr','director'], false, 150),
('resignation','طلب استقالة','شؤون الموظفين','[{"key":"last_day","label":"آخر يوم عمل مقترح","type":"date","required":true},{"key":"reason","label":"سبب الاستقالة","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr','director'], false, 160),
('clearance','طلب إخلاء طرف','شؤون الموظفين','[{"key":"last_day","label":"آخر يوم عمل","type":"date","required":true},{"key":"notes","label":"ملاحظات","type":"textarea"}]'::jsonb, ARRAY['manager','hr','director'], false, 170),
('training_course','طلب دورة تدريبية','التطوير والتدريب','[{"key":"course","label":"اسم الدورة","type":"text","required":true},{"key":"provider","label":"الجهة المنظمة","type":"text"},{"key":"date_from","label":"من تاريخ","type":"date"},{"key":"date_to","label":"إلى تاريخ","type":"date"},{"key":"cost","label":"التكلفة التقديرية","type":"number"},{"key":"benefit","label":"الفائدة المتوقعة للعمل","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr','director'], false, 180),
('conference','طلب حضور مؤتمر / ورشة','التطوير والتدريب','[{"key":"event","label":"اسم الفعالية","type":"text","required":true},{"key":"location","label":"المكان","type":"text"},{"key":"date_from","label":"من تاريخ","type":"date"},{"key":"date_to","label":"إلى تاريخ","type":"date"},{"key":"purpose","label":"الغرض","type":"textarea"}]'::jsonb, ARRAY['manager','hr','director'], false, 190),
('study_leave','طلب إجازة دراسية','التطوير والتدريب','[{"key":"program","label":"البرنامج الدراسي","type":"text","required":true},{"key":"institution","label":"الجهة التعليمية","type":"text"},{"key":"date_from","label":"من تاريخ","type":"date","required":true},{"key":"date_to","label":"إلى تاريخ","type":"date","required":true},{"key":"justification","label":"المبررات","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr','director'], false, 200),
('complaint','شكوى إدارية','الجودة والسلوك','[{"key":"subject","label":"موضوع الشكوى","type":"text","required":true},{"key":"against","label":"الجهة المشكو منها (اختياري)","type":"text"},{"key":"details","label":"تفاصيل الشكوى","type":"textarea","required":true}]'::jsonb, ARRAY['hr','director'], true, 210),
('grievance','شكوى تظلّم','الجودة والسلوك','[{"key":"decision","label":"القرار المتظلَّم منه","type":"text","required":true},{"key":"decision_date","label":"تاريخ القرار","type":"date"},{"key":"details","label":"أسباب التظلّم","type":"textarea","required":true}]'::jsonb, ARRAY['hr','director'], true, 220),
('suggestion','مقترح تحسين','الجودة والسلوك','[{"key":"title","label":"عنوان المقترح","type":"text","required":true},{"key":"area","label":"المجال","type":"select","options":["إجراءات العمل","بيئة العمل","الأنظمة التقنية","خدمة المستفيدين","أخرى"]},{"key":"details","label":"وصف المقترح","type":"textarea","required":true},{"key":"impact","label":"الأثر المتوقع","type":"textarea"}]'::jsonb, ARRAY['hr'], false, 230),
('violation_report','بلاغ مخالفة','الجودة والسلوك','[{"key":"subject","label":"موضوع البلاغ","type":"text","required":true},{"key":"incident_date","label":"تاريخ الواقعة","type":"date"},{"key":"details","label":"التفاصيل","type":"textarea","required":true}]'::jsonb, ARRAY['hr','director'], true, 240),
('meeting_request','طلب اجتماع مع الإدارة','الجودة والسلوك','[{"key":"with","label":"الجهة المطلوب مقابلتها","type":"text","required":true},{"key":"subject","label":"موضوع الاجتماع","type":"text","required":true},{"key":"preferred_date","label":"موعد مقترح","type":"date"}]'::jsonb, ARRAY['hr'], false, 250),
('general','طلب عام','متفرقات','[{"key":"subject","label":"عنوان الطلب","type":"text","required":true},{"key":"details","label":"تفاصيل الطلب","type":"textarea","required":true}]'::jsonb, ARRAY['manager','hr'], false, 260);