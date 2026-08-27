-- =========================================================
-- تحسينات الأداء وفهارس السرعة ودالة تحليلات لوحة المعلومات
-- =========================================================

-- 1. فهارس تسريع الاستعلامات المركبة
CREATE INDEX IF NOT EXISTS idx_attendance_records_date_status
  ON public.attendance_records (work_date, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_date
  ON public.attendance_records (employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_tasks_dates_status
  ON public.tasks (start_date, due_date, status);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_dates
  ON public.tasks (assignee_id, start_date);

CREATE INDEX IF NOT EXISTS idx_biometric_punches_dedup
  ON public.biometric_punches (device_serial, device_user_id, punched_at);

CREATE INDEX IF NOT EXISTS idx_leave_requests_scope
  ON public.leave_requests (employee_id, stage, start_date, end_date);

-- 2. دالة التحليلات والإحصائيات الشاملة للوحة القيادة (PostgreSQL RPC Function)
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
  p_start_date date,
  p_end_date date,
  p_scope_emp_id uuid DEFAULT NULL,
  p_scope_dept_id uuid DEFAULT NULL,
  p_is_org_wide boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_limit_soon date := current_date + 30;
  v_limit_7days date := current_date + 7;
  v_result jsonb;
BEGIN
  WITH
  -- الموظفون المشمولون بنطاق العرض
  target_employees AS (
    SELECT
      e.id,
      e.full_name,
      e.employee_no,
      e.job_title,
      e.department_id,
      e.section_id,
      e.status,
      d.name AS department_name,
      s.name AS section_name
    FROM public.employees e
    LEFT JOIN public.departments d ON d.id = e.department_id
    LEFT JOIN public.sections s ON s.id = e.section_id
    WHERE e.status = 'active'
      AND (
        p_is_org_wide IS TRUE
        OR (p_scope_dept_id IS NOT NULL AND e.department_id = p_scope_dept_id)
        OR (p_scope_emp_id IS NOT NULL AND e.id = p_scope_emp_id)
      )
  ),

  -- مهام الفترة المحددة
  period_tasks AS (
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      COALESCE(t.progress, 0) AS progress,
      t.start_date,
      t.due_date,
      t.completed_at,
      t.assignee_id
    FROM public.tasks t
    INNER JOIN target_employees te ON te.id = t.assignee_id
    WHERE (t.start_date >= p_start_date AND t.start_date <= p_end_date)
       OR (t.created_at::date >= p_start_date AND t.created_at::date <= p_end_date)
  ),

  -- كافة مهام الموظفين الحالية (لحساب المهام المتأخرة والمستحقة قريباً)
  all_active_tasks AS (
    SELECT
      t.id,
      t.title,
      t.status,
      t.due_date,
      t.assignee_id
    FROM public.tasks t
    INNER JOIN target_employees te ON te.id = t.assignee_id
    WHERE t.status NOT IN ('completed', 'cancelled')
  ),

  -- سجلات الحضور في الفترة
  period_attendance AS (
    SELECT
      a.employee_id,
      a.work_date,
      a.status,
      COALESCE(a.late_minutes, 0) AS late_minutes,
      COALESCE(a.early_leave_minutes, 0) AS early_leave_minutes,
      COALESCE(a.permission_minutes, 0) AS permission_minutes,
      COALESCE(a.overtime_minutes, 0) AS overtime_minutes
    FROM public.attendance_records a
    INNER JOIN target_employees te ON te.id = a.employee_id
    WHERE a.work_date >= p_start_date AND a.work_date <= p_end_date
  ),

  -- سجلات حضور اليوم
  today_attendance AS (
    SELECT
      a.employee_id,
      a.status,
      COALESCE(a.late_minutes, 0) AS late_minutes
    FROM public.attendance_records a
    INNER JOIN target_employees te ON te.id = a.employee_id
    WHERE a.work_date = v_today
  ),

  -- إحصائيات المهام المجمعة لكل موظف
  emp_task_stats AS (
    SELECT
      te.id AS employee_id,
      COUNT(pt.id) AS total_tasks,
      COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) AS completed_tasks,
      COALESCE(AVG(pt.progress), 0) AS avg_progress,
      COUNT(CASE WHEN pt.due_date IS NOT NULL THEN 1 END) AS due_count,
      COUNT(CASE
        WHEN pt.status = 'completed'
         AND (pt.completed_at IS NULL OR pt.due_date IS NULL OR pt.completed_at::date <= pt.due_date)
        THEN 1
      END) AS on_time_count
    FROM target_employees te
    LEFT JOIN period_tasks pt ON pt.assignee_id = te.id
    GROUP BY te.id
  ),

  -- إحصائيات الحضور المجمعة لكل موظف
  emp_att_stats AS (
    SELECT
      te.id AS employee_id,
      COUNT(pa.work_date) AS total_recorded_days,
      COUNT(CASE WHEN pa.status IN ('present', 'permission') THEN 1 END) AS present_days,
      SUM(pa.late_minutes) AS total_late_minutes,
      SUM(pa.early_leave_minutes) AS total_early_minutes,
      SUM(pa.overtime_minutes) AS total_overtime_minutes
    FROM target_employees te
    LEFT JOIN period_attendance pa ON pa.employee_id = te.id
    GROUP BY te.id
  ),

  -- درجات الأداء لكل موظف
  emp_scores AS (
    SELECT
      te.id,
      te.full_name AS name,
      COALESCE(
        NULLIF(CONCAT_WS(' — ', te.job_title, COALESCE(te.section_name, te.department_name)), ''),
        '—'
      ) AS subtitle,
      te.department_id,
      te.department_name,
      te.section_id,
      te.section_name,
      COALESCE(ts.total_tasks, 0) AS "totalTasks",
      COALESCE(ts.completed_tasks, 0) AS "completedTasks",
      COALESCE(att.present_days, 0) AS "presentDays",
      COALESCE(att.total_late_minutes, 0) AS "lateMinutes",
      COALESCE(att.total_overtime_minutes, 0) AS "overtimeMinutes",

      -- درجة المهام (0 - 100)
      ROUND(
        CASE
          WHEN COALESCE(ts.total_tasks, 0) = 0 THEN 0
          ELSE (ts.avg_progress * 0.4) + ((ts.completed_tasks::numeric / ts.total_tasks) * 100 * 0.6)
        END
      )::int AS "tasksScore",

      -- درجة الحضور (0 - 100)
      GREATEST(0, LEAST(100, ROUND(
        CASE
          WHEN COALESCE(att.total_recorded_days, 0) = 0 THEN 100
          ELSE ((att.present_days::numeric / att.total_recorded_days) * 100)
               - ((COALESCE(att.total_late_minutes, 0) + COALESCE(att.total_early_minutes, 0)) / 30.0)
        END
      )))::int AS "attendanceScore",

      -- درجة الالتزام بالمواعيد (0 - 100)
      ROUND(
        CASE
          WHEN COALESCE(ts.due_count, 0) = 0 THEN 100
          ELSE (ts.on_time_count::numeric / ts.due_count) * 100
        END
      )::int AS "punctualityScore"
    FROM target_employees te
    LEFT JOIN emp_task_stats ts ON ts.employee_id = te.id
    LEFT JOIN emp_att_stats att ON att.employee_id = te.id
  ),

  -- الحساب النهائي لدرجات الموظفين
  performer_scores AS (
    SELECT
      es.*,
      ROUND(
        (es."tasksScore" * 0.5) + (es."attendanceScore" * 0.3) + (es."punctualityScore" * 0.2)
      )::int AS score,
      CASE
        WHEN ROUND((es."tasksScore" * 0.5) + (es."attendanceScore" * 0.3) + (es."punctualityScore" * 0.2)) >= 90 THEN 'ممتاز'
        WHEN ROUND((es."tasksScore" * 0.5) + (es."attendanceScore" * 0.3) + (es."punctualityScore" * 0.2)) >= 80 THEN 'جيد جداً'
        WHEN ROUND((es."tasksScore" * 0.5) + (es."attendanceScore" * 0.3) + (es."punctualityScore" * 0.2)) >= 70 THEN 'جيد'
        WHEN ROUND((es."tasksScore" * 0.5) + (es."attendanceScore" * 0.3) + (es."punctualityScore" * 0.2)) >= 60 THEN 'مقبول'
        ELSE 'ضعيف'
      END AS grade,
      (es."completedTasks" >= 1 OR es."presentDays" >= 3) AS eligible,
      1 AS "memberCount"
    FROM emp_scores es
  ),

  -- تجميع درجات الإدارات
  dept_scores AS (
    SELECT
      d.id,
      d.name,
      CONCAT(COUNT(ps.id), ' موظف') AS subtitle,
      COALESCE(SUM(ps."totalTasks"), 0) AS "totalTasks",
      COALESCE(SUM(ps."completedTasks"), 0) AS "completedTasks",
      COALESCE(SUM(ps."presentDays"), 0) AS "presentDays",
      COALESCE(SUM(ps."lateMinutes"), 0) AS "lateMinutes",
      COALESCE(ROUND(AVG(ps."tasksScore")), 0)::int AS "tasksScore",
      COALESCE(ROUND(AVG(ps."attendanceScore")), 0)::int AS "attendanceScore",
      COALESCE(ROUND(AVG(ps."punctualityScore")), 0)::int AS "punctualityScore",
      COALESCE(ROUND(AVG(ps.score)), 0)::int AS score,
      CASE
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 90 THEN 'ممتاز'
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 80 THEN 'جيد جداً'
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 70 THEN 'جيد'
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 60 THEN 'مقبول'
        ELSE 'ضعيف'
      END AS grade,
      (COUNT(ps.id) > 0 AND (SUM(ps."completedTasks") >= 1 OR SUM(ps."presentDays") >= 3)) AS eligible,
      COUNT(ps.id)::int AS "memberCount"
    FROM public.departments d
    INNER JOIN performer_scores ps ON ps.department_id = d.id
    GROUP BY d.id, d.name
  ),

  -- تجميع درجات الأقسام
  section_scores AS (
    SELECT
      s.id,
      s.name,
      COALESCE(MAX(ps.department_name), '—') AS subtitle,
      COALESCE(SUM(ps."totalTasks"), 0) AS "totalTasks",
      COALESCE(SUM(ps."completedTasks"), 0) AS "completedTasks",
      COALESCE(SUM(ps."presentDays"), 0) AS "presentDays",
      COALESCE(SUM(ps."lateMinutes"), 0) AS "lateMinutes",
      COALESCE(ROUND(AVG(ps."tasksScore")), 0)::int AS "tasksScore",
      COALESCE(ROUND(AVG(ps."attendanceScore")), 0)::int AS "attendanceScore",
      COALESCE(ROUND(AVG(ps."punctualityScore")), 0)::int AS "punctualityScore",
      COALESCE(ROUND(AVG(ps.score)), 0)::int AS score,
      CASE
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 90 THEN 'ممتاز'
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 80 THEN 'جيد جداً'
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 70 THEN 'جيد'
        WHEN COALESCE(ROUND(AVG(ps.score)), 0) >= 60 THEN 'مقبول'
        ELSE 'ضعيف'
      END AS grade,
      (COUNT(ps.id) > 0 AND (SUM(ps."completedTasks") >= 1 OR SUM(ps."presentDays") >= 3)) AS eligible,
      COUNT(ps.id)::int AS "memberCount"
    FROM public.sections s
    INNER JOIN performer_scores ps ON ps.section_id = s.id
    GROUP BY s.id, s.name
  ),

  -- وثائق قريبة من الانتهاء
  expiring_documents AS (
    SELECT
      d.id,
      d.title,
      d.expiry_date,
      e.full_name AS employee_name
    FROM public.employee_documents d
    INNER JOIN target_employees e ON e.id = d.employee_id
    WHERE d.expiry_date IS NOT NULL
      AND d.expiry_date <= v_limit_soon
    ORDER BY d.expiry_date ASC
    LIMIT 10
  ),

  -- طلبات إجازة معلقة
  pending_leaves AS (
    SELECT
      l.id,
      l.stage,
      l.start_date,
      l.end_date,
      e.full_name AS employee_name
    FROM public.leave_requests l
    INNER JOIN target_employees e ON e.id = l.employee_id
    WHERE l.stage IN ('pending_manager', 'pending_hr', 'pending_director')
    ORDER BY l.created_at DESC
    LIMIT 10
  ),

  -- تقييمات معلقة
  pending_evaluations AS (
    SELECT
      ev.id,
      ev.approval_stage,
      e.full_name AS employee_name
    FROM public.evaluations ev
    INNER JOIN target_employees e ON e.id = ev.employee_id
    WHERE ev.approved IS FALSE
       OR ev.approval_stage IN ('pending_manager', 'pending_hr', 'pending_director')
    ORDER BY ev.created_at DESC
    LIMIT 10
  )

  -- بناء النتيجة الشاملة كـ JSON موحد وفائق السرعة
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'totalEmployees', (SELECT COUNT(*) FROM target_employees),
      'totalPeriodTasks', (SELECT COUNT(*) FROM period_tasks),
      'completedPeriodTasks', (SELECT COUNT(*) FROM period_tasks WHERE status = 'completed'),
      'inProgressPeriodTasks', (SELECT COUNT(*) FROM period_tasks WHERE status = 'in_progress'),
      'newPeriodTasks', (SELECT COUNT(*) FROM period_tasks WHERE status = 'new'),
      'overdueTasks', (SELECT COUNT(*) FROM all_active_tasks WHERE due_date < v_today),
      'dueSoonTasks', (SELECT COUNT(*) FROM all_active_tasks WHERE due_date >= v_today AND due_date <= v_limit_7days),
      'completionRate', (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / COUNT(*)) * 100)
        END
        FROM period_tasks
      ),
      'avgCompliance', (SELECT COALESCE(ROUND(AVG("attendanceScore")), 0) FROM performer_scores),
      'todayPresent', (SELECT COUNT(*) FROM today_attendance WHERE status IN ('present', 'permission') AND late_minutes = 0),
      'todayLate', (SELECT COUNT(*) FROM today_attendance WHERE status = 'present' AND late_minutes > 0),
      'todayLeave', (SELECT COUNT(*) FROM today_attendance WHERE status IN ('leave', 'permission')),
      'todayAbsent', (SELECT COUNT(*) FROM today_attendance WHERE status = 'absent')
    ),
    'employeeScores', (SELECT COALESCE(jsonb_agg(to_jsonb(ps) ORDER BY ps.score DESC), '[]'::jsonb) FROM performer_scores ps),
    'deptScores', (SELECT COALESCE(jsonb_agg(to_jsonb(ds) ORDER BY ds.score DESC), '[]'::jsonb) FROM dept_scores ds),
    'sectionScores', (SELECT COALESCE(jsonb_agg(to_jsonb(ss) ORDER BY ss.score DESC), '[]'::jsonb) FROM section_scores ss),
    'expiringDocs', (SELECT COALESCE(jsonb_agg(to_jsonb(ed)), '[]'::jsonb) FROM expiring_documents ed),
    'pendingLeaves', (SELECT COALESCE(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) FROM pending_leaves pl),
    'pendingEvaluations', (SELECT COALESCE(jsonb_agg(to_jsonb(pe)), '[]'::jsonb) FROM pending_evaluations pe)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(date, date, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(date, date, uuid, uuid, boolean) TO service_role;