import { createFileRoute } from "@tanstack/react-router";
import { runAllCronTasks, auditDailyAttendance, checkDocumentExpirations, dispatchWeeklyPerformanceDigest } from "@/lib/cron.server";

export const Route = createFileRoute("/api/cron/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        const cronSecret = process.env["CRON_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];

        // التحقق من مفتاح الحماية
        if (cronSecret && token !== cronSecret) {
          return Response.json({ error: "غير مصرح: مفتاح الأمان غير صحيح" }, { status: 401 });
        }

        const url = new URL(request.url);
        const task = url.searchParams.get("task") ?? "all";

        try {
          let result;
          if (task === "attendance") {
            result = await auditDailyAttendance();
          } else if (task === "documents") {
            result = await checkDocumentExpirations();
          } else if (task === "digest") {
            result = await dispatchWeeklyPerformanceDigest();
          } else {
            result = await runAllCronTasks();
          }

          return Response.json({ ok: true, task, timestamp: new Date().toISOString(), result });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
      GET: async () => {
        return Response.json({
          status: "healthy",
          availableTasks: ["attendance", "documents", "digest", "all"],
          usage: "POST /api/cron/dispatch?task=all with Authorization: Bearer <CRON_SECRET>",
        });
      },
    },
  },
});
