import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const kindSchema = z.enum(["asset", "vehicle", "document", "cash"]);
const nstr = z.string().trim().max(500).nullable().optional();

export const listCustodyCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listCategories } = await import("@/lib/custody.server");
    return listCategories();
  });

export const listCustodyAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listAssets } = await import("@/lib/custody.server");
    return listAssets();
  });

export const saveCustodyAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        code: z.string().trim().min(1).max(60),
        name: z.string().trim().min(1).max(200),
        kind: kindSchema,
        category_id: z.string().uuid().nullable().optional(),
        status: z.string().nullable().optional(),
        serial_no: nstr,
        brand: nstr,
        model: nstr,
        purchase_date: nstr,
        value: z.number().nonnegative().nullable().optional(),
        department_id: z.string().uuid().nullable().optional(),
        location: nstr,
        plate_no: nstr,
        manufacture_year: z.number().int().nullable().optional(),
        insurance_expiry: nstr,
        license_expiry: nstr,
        odometer: z.number().int().nullable().optional(),
        document_no: nstr,
        document_expiry: nstr,
        notes: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveAsset } = await import("@/lib/custody.server");
    return saveAsset(context.userId, data);
  });

export const deleteCustodyAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteAsset } = await import("@/lib/custody.server");
    return deleteAsset(context.userId, data.id);
  });

export const listCustodyAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listAssignments } = await import("@/lib/custody.server");
    return listAssignments(context.userId);
  });

export const saveCustodyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        employee_id: z.string().uuid(),
        kind: kindSchema,
        purpose: nstr,
        expected_return_date: nstr,
        cash_amount: z.number().nonnegative().nullable().optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
        submit: z.boolean().optional(),
        items: z
          .array(
            z.object({
              asset_id: z.string().uuid().nullable().optional(),
              title: z.string().trim().min(1).max(200),
              quantity: z.number().int().positive().nullable().optional(),
              condition_out: nstr,
              odometer_out: z.number().int().nullable().optional(),
              notes: nstr,
            }),
          )
          .max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveAssignment } = await import("@/lib/custody.server");
    return saveAssignment(context.userId, data);
  });

export const deleteCustodyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteAssignment } = await import("@/lib/custody.server");
    return deleteAssignment(context.userId, data.id);
  });

export const decideCustodyAssignment = createServerFn({ method: "POST" })
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
    const { decideAssignment } = await import("@/lib/custody.server");
    return decideAssignment(context.userId, data.id, data.action, data.note);
  });

export const handOverCustody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { handOver } = await import("@/lib/custody.server");
    return handOver(context.userId, data.id);
  });

export const returnCustodyItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        items: z
          .array(
            z.object({
              id: z.string().uuid(),
              return_state: z.enum(["good", "damaged", "lost"]),
              condition_in: nstr,
              odometer_in: z.number().int().nullable().optional(),
            }),
          )
          .min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { returnItems } = await import("@/lib/custody.server");
    return returnItems(context.userId, data.id, data.items);
  });

export const addCustodyTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        assignment_id: z.string().uuid(),
        tx_date: z.string(),
        tx_type: z.enum(["disbursement", "expense", "settlement"]),
        amount: z.number().positive(),
        description: nstr,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addTransaction } = await import("@/lib/custody.server");
    return addTransaction(context.userId, data);
  });

export const listCustodyTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ assignmentId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { listTransactions } = await import("@/lib/custody.server");
    return listTransactions(data.assignmentId);
  });

export const listCustodyTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ assignmentId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { listApprovalTrail } = await import("@/lib/custody.server");
    return listApprovalTrail(data.assignmentId);
  });
