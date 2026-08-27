-- =========================================================
-- فهارس الاستعلام المركبة لتسريع التقارير والاستعلامات
-- Compound Database Indexes for Reporting & Query Optimization
-- =========================================================

-- 1. فهارس سجلات الدوام والحضور
CREATE INDEX IF NOT EXISTS idx_attendance_records_date_emp
  ON public.attendance_records (work_date, employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_status_date
  ON public.attendance_records (employee_id, status, work_date);

-- 2. فهارس جدول المهام
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status
  ON public.tasks (assignee_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date
  ON public.tasks (status, due_date);

-- 3. فهارس طلبات الإجازات والأذونات
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_stage
  ON public.leave_requests (employee_id, stage);

CREATE INDEX IF NOT EXISTS idx_leave_requests_stage_dates
  ON public.leave_requests (stage, start_date, end_date);

-- 4. فهارس التقييمات وسجلات التدقيق
CREATE INDEX IF NOT EXISTS idx_evaluations_employee_stage
  ON public.evaluations (employee_id, approval_stage);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_entity
  ON public.audit_logs (created_at DESC, entity);
