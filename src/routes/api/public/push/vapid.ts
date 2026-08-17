import { createFileRoute } from "@tanstack/react-router";

/** المفتاح العام للدفع — يستخدمه عامل الخدمة لإعادة الاشتراك تلقائياً */
export const Route = createFileRoute("/api/public/push/vapid")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
