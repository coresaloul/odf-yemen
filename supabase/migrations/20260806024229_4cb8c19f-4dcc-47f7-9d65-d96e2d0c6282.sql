-- إضافة وثيقة: الموظف لنفسه + الموارد البشرية (المدير التنفيذي مغطّى بسياسة ALL الحالية)
CREATE POLICY employee_documents_insert_self_or_hr
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (private.is_self_employee(employee_id) OR private.is_hr());

CREATE POLICY employee_documents_hr_update
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (private.is_hr()) WITH CHECK (private.is_hr());

CREATE POLICY employee_documents_hr_delete
  ON public.employee_documents FOR DELETE TO authenticated
  USING (private.is_hr());

-- رفع ملف في مجلد الموظف نفسه فقط
CREATE POLICY emp_docs_self_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.id::text = (storage.foldername(name))[1]
    )
  );