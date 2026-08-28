import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateAiDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        docType: z.enum(["notice", "warning", "recognition", "promotion", "delegation"]),
        employeeName: z.string().min(2),
        jobTitle: z.string().nullable().optional(),
        departmentName: z.string().nullable().optional(),
        reasonOrAchievement: z.string().min(3, "يرجى كتابة سبب أو تفاصيل الخطاب"),
        sanctionDegree: z.string().nullable().optional(),
        customNotes: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { draftAdministrativeDocument } = await import("@/lib/ai-hr.server");
    const result = await draftAdministrativeDocument({
      ...data,
      jobTitle: data.jobTitle ?? null,
      departmentName: data.departmentName ?? null,
      sanctionDegree: data.sanctionDegree ?? null,
      customNotes: data.customNotes ?? null,
    });
    return result;
  });

export const generateAiPerformanceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeId: z.string().uuid(),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { analyzeEmployeePerformance } = await import("@/lib/ai-hr.server");
    const result = await analyzeEmployeePerformance(data.employeeId, data.periodStart, data.periodEnd);
    return result;
  });
