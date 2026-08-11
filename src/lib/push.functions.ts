import { createServerFn } from "@tanstack/react-start";

/** المفتاح العام لإشعارات الدفع (آمن للنشر في المتصفح) */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null };
});
