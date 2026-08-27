
create or replace function private.can_view_correspondence(_c_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.correspondence c
    where c.id = _c_id
      and (
        private.is_director()
        or private.is_hr()
        or c.created_by = auth.uid()
        or (
          c.confidentiality <> 'very_confidential'
          and c.assigned_to in (select e.id from public.employees e where e.user_id = auth.uid())
        )
      )
  )
$$;

revoke all on function private.can_view_correspondence(uuid) from public, anon;
grant execute on function private.can_view_correspondence(uuid) to authenticated;

drop policy if exists correspondence_read on public.correspondence;
create policy correspondence_read on public.correspondence for select to authenticated
using (
  private.is_director() or private.is_hr() or created_by = auth.uid()
  or (confidentiality <> 'very_confidential'
      and assigned_to in (select e.id from public.employees e where e.user_id = auth.uid()))
);

drop policy if exists correspondence_update on public.correspondence;
create policy correspondence_update on public.correspondence for update to authenticated
using (
  private.is_director() or private.is_hr() or created_by = auth.uid()
  or (confidentiality <> 'very_confidential'
      and assigned_to in (select e.id from public.employees e where e.user_id = auth.uid()))
)
with check (
  private.is_director() or private.is_hr() or created_by = auth.uid()
  or (confidentiality <> 'very_confidential'
      and assigned_to in (select e.id from public.employees e where e.user_id = auth.uid()))
);

drop policy if exists correspondence_actions_read on public.correspondence_actions;
create policy correspondence_actions_read on public.correspondence_actions for select to authenticated
using (private.can_view_correspondence(correspondence_id));

drop policy if exists correspondence_actions_insert on public.correspondence_actions;
create policy correspondence_actions_insert on public.correspondence_actions for insert to authenticated
with check (actor_id = auth.uid() and private.can_view_correspondence(correspondence_id));
