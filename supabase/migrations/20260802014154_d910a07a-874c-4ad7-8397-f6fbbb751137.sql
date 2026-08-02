CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inapp_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  inapp_task_assigned boolean NOT NULL DEFAULT true,
  email_task_assigned boolean NOT NULL DEFAULT true,
  inapp_task_status boolean NOT NULL DEFAULT true,
  email_task_status boolean NOT NULL DEFAULT true,
  inapp_task_progress boolean NOT NULL DEFAULT true,
  email_task_progress boolean NOT NULL DEFAULT true,
  inapp_evaluation boolean NOT NULL DEFAULT true,
  email_evaluation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification preferences"
ON public.notification_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notification preferences"
ON public.notification_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notification preferences"
ON public.notification_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.wants_notification(_user_id uuid, _channel text, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.user_id IS NULL THEN true
    WHEN _channel = 'inapp' AND NOT p.inapp_enabled THEN false
    WHEN _channel = 'email' AND NOT p.email_enabled THEN false
    WHEN _channel = 'inapp' AND _type = 'task_assigned' THEN p.inapp_task_assigned
    WHEN _channel = 'inapp' AND _type = 'task_status' THEN p.inapp_task_status
    WHEN _channel = 'inapp' AND _type = 'task_progress' THEN p.inapp_task_progress
    WHEN _channel = 'inapp' AND _type = 'evaluation' THEN p.inapp_evaluation
    WHEN _channel = 'email' AND _type = 'task_assigned' THEN p.email_task_assigned
    WHEN _channel = 'email' AND _type = 'task_status' THEN p.email_task_status
    WHEN _channel = 'email' AND _type = 'task_progress' THEN p.email_task_progress
    WHEN _channel = 'email' AND _type = 'evaluation' THEN p.email_evaluation
    ELSE true
  END
  FROM (SELECT 1) dummy
  LEFT JOIN public.notification_preferences p ON p.user_id = _user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.wants_notification(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.wants_notification(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM anon, public;

CREATE TRIGGER trg_create_notification_preferences
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();

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
    IF assignee_user IS NOT NULL AND public.wants_notification(assignee_user, 'inapp', 'task_assigned') THEN
      INSERT INTO public.notifications (user_id, title, body, type, task_id)
      VALUES (assignee_user, 'تم تكليفك بمهمة جديدة', NEW.title, 'task_assigned', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND assignee_user IS NOT NULL
       AND public.wants_notification(assignee_user, 'inapp', 'task_assigned') THEN
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

      IF assignee_user IS NOT NULL AND public.wants_notification(assignee_user, 'inapp', 'task_status') THEN
        INSERT INTO public.notifications (user_id, title, body, type, task_id)
        VALUES (assignee_user, 'تغيّرت حالة المهمة', NEW.title || ' — الحالة الآن: ' || status_ar, 'task_status', NEW.id);
      END IF;

      IF assigner_user IS NOT NULL AND assigner_user IS DISTINCT FROM assignee_user
         AND public.wants_notification(assigner_user, 'inapp', 'task_progress') THEN
        INSERT INTO public.notifications (user_id, title, body, type, task_id)
        VALUES (assigner_user, 'تحديث حالة مهمة مكلّف بها', COALESCE(assignee_name, 'موظف') || ': ' || NEW.title || ' — ' || status_ar, 'task_status', NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_task_events() FROM anon, public;