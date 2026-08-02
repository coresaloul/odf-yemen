CREATE OR REPLACE FUNCTION public.set_notifications_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'task',
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated can create notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id) WHERE is_read = false;

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_notifications_updated_at();

CREATE OR REPLACE FUNCTION public.notify_task_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_user uuid;
  assigner_user uuid;
  assignee_name text;
  status_ar text;
BEGIN
  SELECT user_id, full_name INTO assignee_user, assignee_name
  FROM public.employees WHERE id = NEW.assignee_id;

  IF NEW.assigned_by IS NOT NULL THEN
    SELECT user_id INTO assigner_user FROM public.employees WHERE id = NEW.assigned_by;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF assignee_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, task_id)
      VALUES (assignee_user, 'تم تكليفك بمهمة جديدة', NEW.title, 'task_assigned', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND assignee_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, task_id)
      VALUES (assignee_user, 'تم تكليفك بمهمة جديدة', NEW.title, 'task_assigned', NEW.id);
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      status_ar := CASE NEW.status::text
        WHEN 'pending' THEN 'قيد الانتظار'
        WHEN 'in_progress' THEN 'قيد التنفيذ'
        WHEN 'completed' THEN 'مكتملة'
        WHEN 'cancelled' THEN 'ملغاة'
        WHEN 'overdue' THEN 'متأخرة'
        ELSE NEW.status::text END;

      IF assignee_user IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, task_id)
        VALUES (assignee_user, 'تغيّرت حالة المهمة', NEW.title || ' — الحالة الآن: ' || status_ar, 'task_status', NEW.id);
      END IF;

      IF assigner_user IS NOT NULL AND assigner_user IS DISTINCT FROM assignee_user THEN
        INSERT INTO public.notifications (user_id, title, body, type, task_id)
        VALUES (assigner_user, 'تحديث حالة مهمة مكلّف بها', COALESCE(assignee_name, 'موظف') || ': ' || NEW.title || ' — ' || status_ar, 'task_status', NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_task_events() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_notifications_updated_at() FROM anon, public;

CREATE TRIGGER trg_tasks_notify
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_events();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;