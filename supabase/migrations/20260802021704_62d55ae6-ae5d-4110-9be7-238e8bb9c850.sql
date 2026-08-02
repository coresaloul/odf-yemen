REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_supervise(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_employee_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_director() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_hr() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_self_employee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wants_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_notifications_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_evaluation(uuid, text, text) TO authenticated;