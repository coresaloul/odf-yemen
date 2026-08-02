DROP POLICY IF EXISTS task_files_select ON storage.objects;

CREATE POLICY task_files_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-files'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.task_attachments a
      JOIN public.tasks t ON t.id = a.task_id
      WHERE a.file_path = storage.objects.name
        AND (
          a.uploaded_by = auth.uid()
          OR private.is_self_employee(t.assignee_id)
          OR private.can_supervise(t.assignee_id)
        )
    )
  )
);