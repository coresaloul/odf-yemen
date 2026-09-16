-- 1. Remove overly permissive write policies (role-scoped policies already exist)
DROP POLICY IF EXISTS pr_grants_write ON public.pr_grant_opportunities;
DROP POLICY IF EXISTS pr_tranches_write ON public.pr_payment_tranches;

-- 2. Restrict SECURITY DEFINER functions in the exposed API schema to signed-in users only
REVOKE ALL ON FUNCTION public.get_dashboard_analytics(date, date, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(date, date, uuid, uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;