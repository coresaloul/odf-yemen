DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
REVOKE INSERT ON public.notifications FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_events() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_notifications_updated_at() FROM authenticated;