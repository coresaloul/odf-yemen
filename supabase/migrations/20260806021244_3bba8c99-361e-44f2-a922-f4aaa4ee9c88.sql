
CREATE POLICY "emp_docs_admin_all" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (private.has_role(auth.uid(), 'hr'::app_role) OR private.has_role(auth.uid(), 'executive_director'::app_role))
)
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (private.has_role(auth.uid(), 'hr'::app_role) OR private.has_role(auth.uid(), 'executive_director'::app_role))
);

CREATE POLICY "emp_docs_self_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.id::text = (storage.foldername(name))[1]
  )
);
