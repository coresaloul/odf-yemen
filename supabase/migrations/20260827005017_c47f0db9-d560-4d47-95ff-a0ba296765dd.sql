
drop policy if exists correspondence_attachments_read on public.correspondence_attachments;
create policy correspondence_attachments_read on public.correspondence_attachments for select to authenticated
using (private.can_view_correspondence(correspondence_id));

drop policy if exists correspondence_attachments_insert on public.correspondence_attachments;
create policy correspondence_attachments_insert on public.correspondence_attachments for insert to authenticated
with check (uploaded_by = auth.uid() and private.can_view_correspondence(correspondence_id));
