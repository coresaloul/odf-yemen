create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated;

drop function if exists public.submit_evaluation(uuid);
drop function if exists public.decide_evaluation(uuid, text, text);

alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.is_director() set schema private;
alter function public.is_hr() set schema private;
alter function public.current_employee_id() set schema private;
alter function public.can_supervise(uuid) set schema private;
alter function public.is_self_employee(uuid) set schema private;
alter function public.wants_notification(uuid, text, text) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.notify_task_events() set schema private;
alter function public.create_default_notification_preferences() set schema private;

create or replace function private.is_director()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_role(auth.uid(), 'executive_director');
$$;

create or replace function private.can_supervise(_employee_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_role(auth.uid(), 'executive_director')
      or exists (
        select 1 from public.employees e
        where e.id = _employee_id
          and (
            e.manager_id = private.current_employee_id()
            or e.department_id in (select d.id from public.departments d where d.manager_id = private.current_employee_id())
            or e.section_id in (select s.id from public.sections s where s.manager_id = private.current_employee_id())
          )
      );
$$;

create or replace function private.is_self_employee(_employee_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select _employee_id = private.current_employee_id();
$$;

create or replace function private.notify_task_events()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
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
    IF assignee_user IS NOT NULL AND private.wants_notification(assignee_user, 'inapp', 'task_assigned') THEN
      INSERT INTO public.notifications (user_id, title, body, type, task_id)
      VALUES (assignee_user, 'تم تكليفك بمهمة جديدة', NEW.title, 'task_assigned', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND assignee_user IS NOT NULL
       AND private.wants_notification(assignee_user, 'inapp', 'task_assigned') THEN
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

      IF assignee_user IS NOT NULL AND private.wants_notification(assignee_user, 'inapp', 'task_status') THEN
        INSERT INTO public.notifications (user_id, title, body, type, task_id)
        VALUES (assignee_user, 'تغيّرت حالة المهمة', NEW.title || ' — الحالة الآن: ' || status_ar, 'task_status', NEW.id);
      END IF;

      IF assigner_user IS NOT NULL AND assigner_user IS DISTINCT FROM assignee_user
         AND private.wants_notification(assigner_user, 'inapp', 'task_progress') THEN
        INSERT INTO public.notifications (user_id, title, body, type, task_id)
        VALUES (assigner_user, 'تحديث حالة مهمة مكلّف بها', COALESCE(assignee_name, 'موظف') || ': ' || NEW.title || ' — ' || status_ar, 'task_status', NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

revoke all on function private.has_role(uuid, public.app_role) from public, anon;
revoke all on function private.is_director() from public, anon;
revoke all on function private.is_hr() from public, anon;
revoke all on function private.current_employee_id() from public, anon;
revoke all on function private.can_supervise(uuid) from public, anon;
revoke all on function private.is_self_employee(uuid) from public, anon;
revoke all on function private.wants_notification(uuid, text, text) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.notify_task_events() from public, anon, authenticated;
revoke all on function private.create_default_notification_preferences() from public, anon, authenticated;

grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.is_director() to authenticated;
grant execute on function private.is_hr() to authenticated;
grant execute on function private.current_employee_id() to authenticated;
grant execute on function private.can_supervise(uuid) to authenticated;
grant execute on function private.is_self_employee(uuid) to authenticated;
grant execute on all functions in schema private to service_role;