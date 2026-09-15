DO $$
DECLARE
  t text;
  write_tables text[] := ARRAY[
    'pr_partners', 'pr_interactions', 'pr_agreements',
    'pr_grant_opportunities', 'pr_donations', 'pr_payment_tranches', 'pr_events'
  ];
BEGIN
  FOREACH t IN ARRAY write_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.is_hr() OR private.is_director()) WITH CHECK (private.is_hr() OR private.is_director())',
      t || '_write', t
    );
  END LOOP;
END $$;