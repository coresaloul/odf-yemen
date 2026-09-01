CREATE TABLE IF NOT EXISTS public.org_branding (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  org_name text NOT NULL DEFAULT 'مؤسسة اليتيم التنموية',
  system_name text NOT NULL DEFAULT 'مدير | نظام الموارد البشرية والتخطيط والتقارير',
  logo_path text,
  copyright text NOT NULL DEFAULT '© جميع الحقوق محفوظة',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.org_branding TO anon;
GRANT SELECT, INSERT, UPDATE ON public.org_branding TO authenticated;
GRANT ALL ON public.org_branding TO service_role;

ALTER TABLE public.org_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_branding_public_read" ON public.org_branding;
CREATE POLICY "org_branding_public_read" ON public.org_branding FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "org_branding_admin_insert" ON public.org_branding;
CREATE POLICY "org_branding_admin_insert" ON public.org_branding FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role));

DROP POLICY IF EXISTS "org_branding_admin_update" ON public.org_branding;
CREATE POLICY "org_branding_admin_update" ON public.org_branding FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role));

INSERT INTO public.org_branding (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_admin_write" ON storage.objects;
CREATE POLICY "branding_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role)));

DROP POLICY IF EXISTS "branding_admin_update" ON storage.objects;
CREATE POLICY "branding_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role)))
  WITH CHECK (bucket_id = 'branding' AND (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role)));

DROP POLICY IF EXISTS "branding_admin_delete" ON storage.objects;
CREATE POLICY "branding_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (private.has_role(auth.uid(), 'executive_director'::public.app_role) OR private.has_role(auth.uid(), 'hr'::public.app_role)));