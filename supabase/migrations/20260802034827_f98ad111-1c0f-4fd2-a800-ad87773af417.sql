DROP POLICY IF EXISTS task_files_update ON storage.objects;

CREATE POLICY task_files_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'task-files'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.task_attachments a
      WHERE a.file_path = storage.objects.name
        AND a.uploaded_by = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'task-files'
  AND owner = auth.uid()
);