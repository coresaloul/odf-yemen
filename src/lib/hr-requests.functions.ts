import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const valueSchema = z.record(
  z.string(),
  z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]),
);

const fieldSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "textarea", "number", "date", "time", "select", "boolean"]),
  required: z.boolean().optional(),
  options: z.array(z.string().max(120)).optional(),
});

export const listRequestTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listTypes } = await import("@/lib/hr-requests.server");
    return listTypes();
  });

export const listHrRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listRequests } = await import("@/lib/hr-requests.server");
    return listRequests(context.userId);
  });

export const saveHrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        type_id: z.string().uuid(),
        values: valueSchema,
        submit: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveRequest } = await import("@/lib/hr-requests.server");
    return saveRequest(context.userId, data);
  });

export const deleteHrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteRequest } = await import("@/lib/hr-requests.server");
    return deleteRequest(context.userId, data.id);
  });

export const decideHrRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approved", "returned"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideRequest } = await import("@/lib/hr-requests.server");
    return decideRequest(context.userId, data.id, data.action, data.note);
  });

export const saveHrRequestType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        code: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9_]+$/, "الرمز يجب أن يكون بأحرف إنجليزية صغيرة وأرقام و _"),
        name: z.string().trim().min(2).max(120),
        category: z.string().trim().min(2).max(80),
        fields: z.array(fieldSchema).max(30),
        approval_flow: z.array(z.enum(["manager", "hr", "director"])).min(1),
        is_confidential: z.boolean(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveType } = await import("@/lib/hr-requests.server");
    return saveType(context.userId, data);
  });
