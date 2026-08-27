import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const triggerCronTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        task: z.enum(["audit_attendance", "check_documents", "weekly_digest", "all"]),
        target_date: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    const actor = await loadActor(context.userId);
    assertAdmin(actor);

    const {
      auditDailyAttendance,
      checkDocumentExpirations,
      dispatchWeeklyPerformanceDigest,
      runAllCronTasks,
    } = await import("@/lib/cron.server");

    let result;
    if (data.task === "audit_attendance") {
      result = await auditDailyAttendance(data.target_date);
    } else if (data.task === "check_documents") {
      result = await checkDocumentExpirations();
    } else if (data.task === "weekly_digest") {
      result = await dispatchWeeklyPerformanceDigest();
    } else {
      result = await runAllCronTasks();
    }

    await writeAudit(context.userId, {
      action: "تشغيل",
      entity: "مهمة مجدولة",
      entity_label: data.task,
    });

    return { ok: true, result };
  });
