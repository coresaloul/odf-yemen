-- Migration: 20260914000000_pr_resource_mobilization_suite.sql
-- Description: Comprehensive database schema for PR & Resource Mobilization (CRM, Grants Pipeline, Donations, Tranches, Events, Task Sync)

-- 1. Ensure Department & Section exist
DO $$
DECLARE
  v_pr_dept_id uuid;
BEGIN
  -- Insert or fetch PR Department
  SELECT id INTO v_pr_dept_id FROM public.departments WHERE lower(btrim(name)) = 'إدارة العلاقات العامة' LIMIT 1;
  IF v_pr_dept_id IS NULL THEN
    INSERT INTO public.departments (name, description)
    VALUES ('إدارة العلاقات العامة', 'إدارة العلاقات العامة والاتصال المؤسسي وحشد الموارد التنموية')
    RETURNING id INTO v_pr_dept_id;
  END IF;

  -- Insert PR & Resource Mobilization Unit into sections
  IF NOT EXISTS (
    SELECT 1 FROM public.sections 
    WHERE department_id = v_pr_dept_id 
      AND lower(btrim(name)) = 'وحدة العلاقات العامة وحشد الموارد'
  ) THEN
    INSERT INTO public.sections (department_id, name, description)
    VALUES (v_pr_dept_id, 'وحدة العلاقات العامة وحشد الموارد', 'إدارة وتنمية علاقات المانحين والشركاء، قمع التمويل، ورعاية اتفاقيات التنمية ومشاريع الأيتام');
  END IF;
END $$;

-- 2. Evaluation Criteria Templates for PR & Resource Mobilization
INSERT INTO public.evaluation_criteria_templates (name, kind, weight, max_score, sort_order, active)
SELECT 'تحقيق المستهدف التمويلي للمشاريع والمنح', 'behavior', 5, 100, 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.evaluation_criteria_templates WHERE name = 'تحقيق المستهدف التمويلي للمشاريع والمنح');

INSERT INTO public.evaluation_criteria_templates (name, kind, weight, max_score, sort_order, active)
SELECT 'سرعة الاستجابة لخدمة المانحين وإرسال خطابات الشكر', 'behavior', 4, 100, 11, true
WHERE NOT EXISTS (SELECT 1 FROM public.evaluation_criteria_templates WHERE name = 'سرعة الاستجابة لخدمة المانحين وإرسال خطابات الشكر');

INSERT INTO public.evaluation_criteria_templates (name, kind, weight, max_score, sort_order, active)
SELECT 'جودة إعداد المقترحات التمويلية وتقارير الأثر', 'behavior', 4, 100, 12, true
WHERE NOT EXISTS (SELECT 1 FROM public.evaluation_criteria_templates WHERE name = 'جودة إعداد المقترحات التمويلية وتقارير الأثر');

INSERT INTO public.evaluation_criteria_templates (name, kind, weight, max_score, sort_order, active)
SELECT 'توثيق التفاعلات والزيارات الميدانية على النظام', 'behavior', 3, 100, 13, true
WHERE NOT EXISTS (SELECT 1 FROM public.evaluation_criteria_templates WHERE name = 'توثيق التفاعلات والزيارات الميدانية على النظام');

-- 3. Partners & Stakeholders (CRM)
CREATE TABLE IF NOT EXISTS public.pr_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) >= 2),
  type text NOT NULL CHECK (type IN ('international_ngo', 'private_csr', 'business_merchant', 'government', 'individual_donor')),
  contact_person text,
  phone text,
  email text,
  address text,
  website text,
  interest_level integer NOT NULL DEFAULT 3 CHECK (interest_level BETWEEN 1 AND 5),
  influence_level integer NOT NULL DEFAULT 3 CHECK (influence_level BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'dormant', 'inactive')),
  notes text,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Interactions & Visits Log
CREATE TABLE IF NOT EXISTS public.pr_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.pr_partners(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('meeting', 'field_visit', 'phone_call', 'email', 'event')),
  title text NOT NULL CHECK (char_length(title) >= 2),
  interaction_date date NOT NULL DEFAULT CURRENT_DATE,
  location text,
  summary text,
  minutes text,
  attendees text,
  next_action text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Agreements & MoUs
CREATE TABLE IF NOT EXISTS public.pr_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.pr_partners(id) ON DELETE CASCADE,
  reference_no text,
  title text NOT NULL CHECK (char_length(title) >= 2),
  agreement_type text NOT NULL DEFAULT 'mou' CHECK (agreement_type IN ('mou', 'partnership_contract', 'grant_agreement', 'sponsorship')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  total_value numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'YER', 'SAR', 'EUR')),
  document_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expiring_soon', 'expired', 'renewed')),
  renewal_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Grants & Funding Opportunities Pipeline
CREATE TABLE IF NOT EXISTS public.pr_grant_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.pr_partners(id) ON DELETE CASCADE,
  project_title text NOT NULL CHECK (char_length(project_title) >= 2),
  target_sector text NOT NULL DEFAULT 'education' CHECK (target_sector IN ('education', 'vocational_training', 'healthcare', 'social_sponsorship', 'relief', 'infrastructure')),
  stage text NOT NULL DEFAULT 'opportunity' CHECK (stage IN ('opportunity', 'concept_note', 'full_proposal', 'under_review', 'awarded', 'rejected')),
  estimated_amount numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'YER', 'SAR', 'EUR')),
  submission_deadline date,
  decision_date date,
  lead_writer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  concept_summary text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Donations & In-kind Contributions
CREATE TABLE IF NOT EXISTS public.pr_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.pr_partners(id) ON DELETE CASCADE,
  grant_opportunity_id uuid REFERENCES public.pr_grant_opportunities(id) ON DELETE SET NULL,
  donation_type text NOT NULL DEFAULT 'cash' CHECK (donation_type IN ('cash', 'in_kind_equipment', 'in_kind_materials', 'services')),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'YER', 'SAR', 'EUR')),
  in_kind_description text,
  target_project text NOT NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_no text,
  thank_you_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Payment Tranches & Commitments
CREATE TABLE IF NOT EXISTS public.pr_payment_tranches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid REFERENCES public.pr_agreements(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.pr_partners(id) ON DELETE CASCADE,
  tranche_number integer NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'YER', 'SAR', 'EUR')),
  condition_milestone text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'due_soon', 'received', 'overdue')),
  report_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. PR Events & Media Campaigns
CREATE TABLE IF NOT EXISTS public.pr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 2),
  event_type text NOT NULL DEFAULT 'event' CHECK (event_type IN ('graduation', 'workshop_exhibition', 'annual_bazaar', 'press_conference', 'success_story_coverage', 'general_event')),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  location text,
  budget numeric DEFAULT 0,
  target_audience text,
  media_links text,
  coordinator_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS pr_partners_status_idx ON public.pr_partners(status);
CREATE INDEX IF NOT EXISTS pr_partners_type_idx ON public.pr_partners(type);
CREATE INDEX IF NOT EXISTS pr_interactions_partner_idx ON public.pr_interactions(partner_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS pr_agreements_partner_idx ON public.pr_agreements(partner_id);
CREATE INDEX IF NOT EXISTS pr_agreements_end_date_idx ON public.pr_agreements(end_date);
CREATE INDEX IF NOT EXISTS pr_grants_stage_idx ON public.pr_grant_opportunities(stage);
CREATE INDEX IF NOT EXISTS pr_donations_partner_idx ON public.pr_donations(partner_id, received_date DESC);
CREATE INDEX IF NOT EXISTS pr_tranches_due_date_idx ON public.pr_payment_tranches(due_date, status);
CREATE INDEX IF NOT EXISTS pr_events_date_idx ON public.pr_events(event_date);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_pr_partners_updated ON public.pr_partners;
CREATE TRIGGER trg_pr_partners_updated BEFORE UPDATE ON public.pr_partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pr_agreements_updated ON public.pr_agreements;
CREATE TRIGGER trg_pr_agreements_updated BEFORE UPDATE ON public.pr_agreements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pr_grants_updated ON public.pr_grant_opportunities;
CREATE TRIGGER trg_pr_grants_updated BEFORE UPDATE ON public.pr_grant_opportunities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permissions & Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_grant_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_donations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_payment_tranches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_events TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Row Level Security (RLS)
ALTER TABLE public.pr_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_grant_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_payment_tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view PR tables
DROP POLICY IF EXISTS pr_partners_select ON public.pr_partners;
CREATE POLICY pr_partners_select ON public.pr_partners FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pr_interactions_select ON public.pr_interactions;
CREATE POLICY pr_interactions_select ON public.pr_interactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pr_agreements_select ON public.pr_agreements;
CREATE POLICY pr_agreements_select ON public.pr_agreements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pr_grants_select ON public.pr_grant_opportunities;
CREATE POLICY pr_grants_select ON public.pr_grant_opportunities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pr_donations_select ON public.pr_donations;
CREATE POLICY pr_donations_select ON public.pr_donations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pr_tranches_select ON public.pr_payment_tranches;
CREATE POLICY pr_tranches_select ON public.pr_payment_tranches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pr_events_select ON public.pr_events;
CREATE POLICY pr_events_select ON public.pr_events FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update/delete PR tables
DROP POLICY IF EXISTS pr_partners_write ON public.pr_partners;
CREATE POLICY pr_partners_write ON public.pr_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS pr_interactions_write ON public.pr_interactions;
CREATE POLICY pr_interactions_write ON public.pr_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS pr_agreements_write ON public.pr_agreements;
CREATE POLICY pr_agreements_write ON public.pr_agreements FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS pr_grants_write ON public.pr_grant_opportunities;
CREATE POLICY pr_grants_write ON public.pr_grant_opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS pr_donations_write ON public.pr_donations;
CREATE POLICY pr_donations_write ON public.pr_donations FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS pr_tranches_write ON public.pr_payment_tranches;
CREATE POLICY pr_tranches_write ON public.pr_payment_tranches FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS pr_events_write ON public.pr_events;
CREATE POLICY pr_events_write ON public.pr_events FOR ALL TO authenticated USING (true) WITH CHECK (true);