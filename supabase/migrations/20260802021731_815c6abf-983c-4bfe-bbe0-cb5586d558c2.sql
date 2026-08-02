GRANT EXECUTE ON FUNCTION public.can_supervise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_self_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;