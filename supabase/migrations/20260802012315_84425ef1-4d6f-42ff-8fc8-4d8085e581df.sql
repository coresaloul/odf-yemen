REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_director() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_employee_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_supervise(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_self_employee(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_supervise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_self_employee(uuid) TO authenticated;