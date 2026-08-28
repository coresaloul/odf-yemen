-- =========================================================
-- ترقية دالة تحليلات لوحة القيادة ومعادلة احتساب «أفضل موظف»
-- =========================================================

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
  v_days_in_period int := GREATEST(1, (p_end_date - p_start_date + 1));
  v_min_presence int := CASE WHEN (p_end_date - p_start_date + 1) <= 7 THEN 2 ELSE 6 END;
  v_result jsonb;
BEGIN
  WITH
  -- 1. الموظفون المشمولون بنطاق العرض
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

  -- 2. مهام الفترة المحددة مع الأوزان والأولويات
  period_tasks AS (
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      COALESCE(t.progress, 0) AS progress,
      COALESCE(t.weight, 1.0) AS base_weight,
      -- معامل أولوية المهمة
      CASE t.priority
        WHEN 'urgent' THEN 1.5
        WHEN 'high' THEN 1.25
        WHEN 'normal' THEN 1.0
        WHEN 'low' THEN 0.8
        ELSE 1.0
      END AS priority_factor,
      t.start_date,
      t.due_date,
      t.completed_at,
      t.assignee_id
    FROM public.tasks t
    INNER JOIN target_employees te ON te.id = t.assignee_id
    WHERE (t.start_date >= p_start_date AND t.start_date <= p_end_date)
       OR (t.created_at::date >= p_start_date AND t.created_at::date <= p_end_date)
       OR (t.due_date >= p_start_date AND t.due_date <= p_end_date)
  ),

  -- 3. سجلات الحضور في الفترة
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

  -- 4. سجلات حضور اليوم الحالي
  today_attendance AS (
    SELECT
      a.employee_id,
      a.status,
      COALESCE(a.late_minutes, 0) AS late_minutes
    FROM public.attendance_records a
    INNER JOIN target_employees te ON te.id = a.employee_id
    WHERE a.work_date = v_today
  ),

  -- 5. التقييمات المؤسسية المعتمدة خلال الفترة
  period_evaluations AS (
    SELECT
      ev.employee_id,
      AVG(ev.total_score) AS avg_eval_score,
      COUNT(ev.id) AS eval_count
    FROM public.evaluations ev
    INNER JOIN target_employees te ON te.id = ev.employee_id
    WHERE ev.approved IS TRUE
      AND ev.period_start <= p_end_date
      AND ev.period_end >= p_start_date
    GROUP BY ev.employee_id
  ),

  -- 6. التكريمات المعتمدة خلال الفترة
  period_recognitions AS (
    SELECT
      r.employee_id,
      COUNT(r.id) AS recognition_count
    FROM public.employee_recognitions r
    INNER JOIN target_employees te ON te.id = r.employee_id
    WHERE r.stage = 'approved'
      AND r.award_date >= p_start_date
      AND r.award_date <= p_end_date
    GROUP BY r.employee_id
  ),

  -- 7. الجزاءات المعتمدة خلال الفترة
  period_sanctions AS (
    SELECT
      s.employee_id,
      COUNT(s.id) AS sanction_count
    FROM public.disciplinary_actions s
    INNER JOIN target_employees te ON te.id = s.employee_id
    WHERE s.stage = 'approved'
      AND s.created_at::date >= p_start_date
      AND s.created_at::date <= p_end_date
    GROUP BY s.employee_id
  ),

  -- 8. إحصائيات المهام المجمعة والموزونة لكل موظف
  emp_task_stats AS (
    SELECT
      te.id AS employee_id,
      COUNT(pt.id) AS total_tasks,
      COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) AS completed_tasks,
      COALESCE(SUM(pt.base_weight * pt.priority_factor), 0) AS total_weight,
      COALESCE(SUM(CASE WHEN pt.status = 'completed' THEN pt.base_weight * pt.priority_factor ELSE 0 END), 0) AS completed_weight,
      COALESCE(SUM((pt.progress / 100.0) * pt.base_weight * pt.priority_factor), 0) AS progress_weight,
      COUNT(CASE WHEN pt.due_date IS NOT NULL THEN 1 END) AS due_count,
      COUNT(CASE
        WHEN pt.status = 'completed'
         AND (pt.completed_at IS NULL OR pt.due_date IS NULL OR pt.completed_at::date <= pt.due_date)
        THEN 1
      END) AS on_time_count,
      COUNT(CASE
        WHEN pt.status NOT IN ('completed', 'cancelled')
         AND pt.due_date IS NOT NULL
         AND pt.due_date < v_today
        THEN 1
      END) AS overdue_count
    FROM target_employees te
    LEFT JOIN period_tasks pt ON pt.assignee_id = te.id
    GROUP BY te.id
  ),

  -- 9. إحصائيات الحضور المجمعة لكل موظف
  emp_att_stats AS (
    SELECT
      te.id AS employee_id,
      COUNT(pa.work_date) AS total_recorded_days,
      COUNT(CASE WHEN pa.status IN ('present', 'permission') THEN 1 END) AS present_days,
      COUNT(CASE WHEN pa.status = 'leave' THEN 1 END) AS leave_days,
      COUNT(CASE WHEN pa.status = 'absent' THEN 1 END) AS absent_days,
      SUM(pa.late_minutes) AS total_late_minutes,
      SUM(pa.early_leave_minutes) AS total_early_minutes,
      SUM(pa.overtime_minutes) AS total_overtime_minutes
    FROM target_employees te
    LEFT JOIN period_attendance pa ON pa.employee_id = te.id
    GROUP BY te.id
  ),

  -- 10. حساب درجات الموظفين المتقدمة والشاملة
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
      COALESCE(rec.recognition_count, 0) AS "recognitionCount",
      COALESCE(sanc.sanction_count, 0) AS "sanctionCount",
      eval.avg_eval_score,

      -- أ. درجة المهام الموزونة مع مراعاة حجم الإنجاز (0 - 100)
      GREATEST(0, LEAST(100, ROUND(
        CASE
          WHEN COALESCE(ts.total_tasks, 0) = 0 THEN 0
          ELSE (
            -- 40% لمتوسط التقدم الموزون + 60% لنسبة الأوزان المنجزة
            ((ts.progress_weight / NULLIF(ts.total_weight, 0)) * 40.0) +
            ((ts.completed_weight / NULLIF(ts.total_weight, 0)) * 60.0) +
            -- بونص حجم العمل (حتى +5 نقاط)
            CASE
              WHEN ts.completed_tasks >= 10 THEN 5
              WHEN ts.completed_tasks >= 5 THEN 3
              WHEN ts.completed_tasks >= 2 THEN 1
              ELSE 0
            END
          )
        END
      )))::int AS "tasksScore",

      -- ب. درجة الحضور والانضباط العادلة (0 - 100)
      GREATEST(0, LEAST(100, ROUND(
        CASE
          WHEN COALESCE(att.total_recorded_days, 0) = 0 THEN 0
          ELSE (
            -- نسبة الحضور والإجازات المعتمدة
            (((att.present_days + att.leave_days)::numeric / att.total_recorded_days) * 100.0)
            -- خصم التأخير بعد مهلة سماح 15 دقيقة
            - (GREATEST(0, COALESCE(att.total_late_minutes, 0) - 15) / 25.0)
            -- خصم الانصراف المبكر
            - (COALESCE(att.total_early_minutes, 0) / 25.0)
            -- خصم الغياب غير المبرر (8 نقاط لكل يوم غياب)
            - (COALESCE(att.absent_days, 0) * 8.0)
            -- بونص الساعات الإضافية المعتمدة (حتى +5 نقاط)
            + LEAST(5.0, (COALESCE(att.total_overtime_minutes, 0) / 60.0) * 1.0)
          )
        END
      )))::int AS "attendanceScore",

      -- ج. درجة الالتزام بالمواعيد (0 - 100)
      GREATEST(0, LEAST(100, ROUND(
        CASE
          WHEN COALESCE(ts.due_count, 0) = 0 THEN
            -- إذا لم تكن هناك مواعيد نهائية، تعتمد على سرعة إنجاز المهام
            CASE WHEN ts.total_tasks > 0 AND ts.completed_tasks = ts.total_tasks THEN 100
                 WHEN ts.total_tasks > 0 THEN 85
                 ELSE 80 END
          ELSE (
            ((ts.on_time_count::numeric / ts.due_count) * 100.0)
            - (COALESCE(ts.overdue_count, 0) * 10.0)
          )
        END
      )))::int AS "punctualityScore"
    FROM target_employees te
    LEFT JOIN emp_task_stats ts ON ts.employee_id = te.id
    LEFT JOIN emp_att_stats att ON att.employee_id = te.id
    LEFT JOIN period_evaluations eval ON eval.employee_id = te.id
    LEFT JOIN period_recognitions rec ON rec.employee_id = te.id
    LEFT JOIN period_sanctions sanc ON sanc.employee_id = te.id
  ),

  -- 11. الحساب النهائي والترجيحي لدرجات الموظفين
  performer_scores AS (
    SELECT
      es.*,
      -- المعادلة المجمعة الشاملة
      GREATEST(0, LEAST(100, ROUND(
        CASE
          -- في حال وجود تقييم أداء رسمي معتمد: دمج 15% للتقييم
          WHEN es.avg_eval_score IS NOT NULL THEN
            (es."tasksScore" * 0.40) +
            (es."attendanceScore" * 0.30) +
            (es."punctualityScore" * 0.15) +
            (es.avg_eval_score * 0.15) +
            (es."recognitionCount" * 3.0) -
            (es."sanctionCount" * 15.0)
          -- في حال عدم وجود تقييم رسمي: توزيع النسبة على المهام والحضور
          ELSE
            (es."tasksScore" * 0.45) +
            (es."attendanceScore" * 0.35) +
            (es."punctualityScore" * 0.20) +
            (es."recognitionCount" * 3.0) -
            (es."sanctionCount" * 15.0)
        END
      )))::int AS score,

      -- التقدير اللفظي
      CASE
        WHEN ROUND(
          CASE WHEN es.avg_eval_score IS NOT NULL
               THEN (es."tasksScore" * 0.40) + (es."attendanceScore" * 0.30) + (es."punctualityScore" * 0.15) + (es.avg_eval_score * 0.15)
               ELSE (es."tasksScore" * 0.45) + (es."attendanceScore" * 0.35) + (es."punctualityScore" * 0.20) END
        ) >= 90 THEN 'ممتاز'
        WHEN ROUND(
          CASE WHEN es.avg_eval_score IS NOT NULL
               THEN (es."tasksScore" * 0.40) + (es."attendanceScore" * 0.30) + (es."punctualityScore" * 0.15) + (es.avg_eval_score * 0.15)
               ELSE (es."tasksScore" * 0.45) + (es."attendanceScore" * 0.35) + (es."punctualityScore" * 0.20) END
        ) >= 80 THEN 'جيد جداً'
        WHEN ROUND(
          CASE WHEN es.avg_eval_score IS NOT NULL
               THEN (es."tasksScore" * 0.40) + (es."attendanceScore" * 0.30) + (es."punctualityScore" * 0.15) + (es.avg_eval_score * 0.15)
               ELSE (es."tasksScore" * 0.45) + (es."attendanceScore" * 0.35) + (es."punctualityScore" * 0.20) END
        ) >= 70 THEN 'جيد'
        WHEN ROUND(
          CASE WHEN es.avg_eval_score IS NOT NULL
               THEN (es."tasksScore" * 0.40) + (es."attendanceScore" * 0.30) + (es."punctualityScore" * 0.15) + (es.avg_eval_score * 0.15)
               ELSE (es."tasksScore" * 0.45) + (es."attendanceScore" * 0.35) + (es."punctualityScore" * 0.20) END
        ) >= 60 THEN 'مقبول'
        ELSE 'ضعيف'
      END AS grade,

      -- معايير الأهلية للترشح للوحة الشرف
      (
        es."presentDays" >= v_min_presence
        AND (es."completedTasks" >= 1 OR es."totalTasks" >= 1)
        AND es."sanctionCount" = 0
        AND es."attendanceScore" >= 50
      ) AS eligible,

      1 AS "memberCount"
    FROM emp_scores es
  ),

  -- 12. تجميع درجات الإدارات
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
      (COUNT(ps.id) > 0 AND SUM(ps."completedTasks") >= 1 AND AVG(ps.score) >= 60) AS eligible,
      COUNT(ps.id)::int AS "memberCount"
    FROM public.departments d
    INNER JOIN performer_scores ps ON ps.department_id = d.id
    GROUP BY d.id, d.name
  ),

  -- 13. تجميع درجات الأقسام
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
      (COUNT(ps.id) > 0 AND SUM(ps."completedTasks") >= 1 AND AVG(ps.score) >= 60) AS eligible,
      COUNT(ps.id)::int AS "memberCount"
    FROM public.sections s
    INNER JOIN performer_scores ps ON ps.section_id = s.id
    GROUP BY s.id, s.name
  ),

  -- 14. وثائق قريبة من الانتهاء
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

  -- 15. طلبات إجازة معلقة
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

  -- 16. تقييمات معلقة
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

  -- 17. بناء النتيجة الشاملة كـ JSON موحد
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'totalEmployees', (SELECT COUNT(*) FROM target_employees),
      'totalPeriodTasks', (SELECT COUNT(*) FROM period_tasks),
      'completedPeriodTasks', (SELECT COUNT(*) FROM period_tasks WHERE status = 'completed'),
      'inProgressPeriodTasks', (SELECT COUNT(*) FROM period_tasks WHERE status = 'in_progress'),
      'newPeriodTasks', (SELECT COUNT(*) FROM period_tasks WHERE status = 'new'),
      'overdueTasks', (SELECT COUNT(*) FROM period_tasks WHERE status NOT IN ('completed', 'cancelled') AND due_date IS NOT NULL AND due_date < v_today),
      'dueSoonTasks', (SELECT COUNT(*) FROM period_tasks WHERE status NOT IN ('completed', 'cancelled') AND due_date IS NOT NULL AND due_date >= v_today AND due_date <= v_today + 7),
      'completionRate', (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / COUNT(*)) * 100)
        END
        FROM period_tasks
      ),
      'avgCompliance', (
        SELECT COALESCE(ROUND(AVG(ps."attendanceScore")), 100)
        FROM performer_scores ps
        WHERE ps."presentDays" > 0
      ),
      'todayPresent', (SELECT COUNT(*) FROM today_attendance WHERE status = 'present'),
      'todayLate', (SELECT COUNT(*) FROM today_attendance WHERE status = 'present' AND late_minutes > 0),
      'todayLeave', (SELECT COUNT(*) FROM today_attendance WHERE status IN ('leave', 'permission')),
      'todayAbsent', (SELECT COUNT(*) FROM today_attendance WHERE status = 'absent')
    ),
    'employeeScores', COALESCE((
      SELECT jsonb_agg(to_jsonb(ps) ORDER BY ps.score DESC, ps."completedTasks" DESC, ps."tasksScore" DESC, ps."punctualityScore" DESC, ps."attendanceScore" DESC, ps."lateMinutes" ASC)
      FROM performer_scores ps
    ), '[]'::jsonb),
    'deptScores', COALESCE((
      SELECT jsonb_agg(to_jsonb(ds) ORDER BY ds.score DESC, ds."completedTasks" DESC, ds."tasksScore" DESC)
      FROM dept_scores ds
    ), '[]'::jsonb),
    'sectionScores', COALESCE((
      SELECT jsonb_agg(to_jsonb(ss) ORDER BY ss.score DESC, ss."completedTasks" DESC, ss."tasksScore" DESC)
      FROM section_scores ss
    ), '[]'::jsonb),
    'expiringDocs', COALESCE((SELECT jsonb_agg(to_jsonb(ed)) FROM expiring_documents ed), '[]'::jsonb),
    'pendingLeaves', COALESCE((SELECT jsonb_agg(to_jsonb(pl)) FROM pending_leaves pl), '[]'::jsonb),
    'pendingEvaluations', COALESCE((SELECT jsonb_agg(to_jsonb(pe)) FROM pending_evaluations pe), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(date, date, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(date, date, uuid, uuid, boolean) TO service_role;
