import { createFileRoute } from "@tanstack/react-router";

type Body = {
  oldEndpoint?: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
};

const ALLOWED_HOSTS = [
  "fcm.googleapis.com",
  "web.push.apple.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
];

function isPushEndpoint(url: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)) ||
        u.hostname.endsWith(".push.apple.com") ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

/**
 * يستدعيه عامل الخدمة عندما يبدّل المتصفح اشتراك الدفع (pushsubscriptionchange)
 * حتى تستمر الإشعارات بالوصول والتطبيق مغلق.
 */
export const Route = createFileRoute("/api/public/push/resubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { oldEndpoint, endpoint, p256dh, auth } = body;
        if (!oldEndpoint || !endpoint || !p256dh || !auth) {
          return new Response("Bad request", { status: 400 });
        }
        if (!isPushEndpoint(oldEndpoint) || !isPushEndpoint(endpoint)) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // العنوان القديم سرّي بطبيعته ويُستخدم كمُعرِّف للجهاز نفسه
        const { data: existing } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, user_id")
          .eq("endpoint", oldEndpoint)
          .maybeSingle();
        if (!existing) return Response.json({ updated: false }, { status: 404 });

        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
        const { error } = await supabaseAdmin
          .from("push_subscriptions")
          .update({ endpoint, p256dh, auth })
          .eq("id", existing.id);
        if (error) return new Response("Update failed", { status: 500 });

        return Response.json({ updated: true });
      },
    },
  },
});
