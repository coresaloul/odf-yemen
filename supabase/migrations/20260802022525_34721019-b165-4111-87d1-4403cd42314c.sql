-- 1) سحب التنفيذ من الجميع على كل الدوال الحساسة
REVOKE ALL ON FUNCTION public.can_supervise(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_director() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_hr() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_self_employee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_evaluation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_evaluation(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wants_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_notifications_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) إعادة المنح الأدنى: فقط ما تحتاجه سياسات RLS ومسار اعتماد التقييم
GRANT EXECUTE ON FUNCTION public.can_supervise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_self_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_evaluation(uuid, text, text) TO authenticated;

-- 3) صلاحيات الخدمة الداخلية
GRANT EXECUTE ON FUNCTION public.can_supervise(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.wants_notification(uuid, text, text) TO service_role;