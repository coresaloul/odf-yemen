import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";

const TYPE_URL: Record<string, string> = {
  task: "/tasks",
  leave: "/leaves",
  attendance: "/attendance",
  evaluation: "/evaluations",
  approval: "/approvals",
  request: "/requests",
  payroll: "/payroll",
  custody: "/custody",
  discipline: "/discipline",
  lifecycle: "/lifecycle",
};

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_DISPATCH_SECRET"];
        if (!secret || request.headers.get("x-push-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const vapid = {
          subject: process.env["VAPID_SUBJECT"] ?? "mailto:no-reply@yateemdev.org",
          publicKey: process.env["VAPID_PUBLIC_KEY"],
          privateKey: process.env["VAPID_PRIVATE_KEY"],
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return Response.json({ sent: 0, reason: "vapid_not_configured" });
        }

        let body: { notification_id?: string };
        try {
          body = (await request.json()) as { notification_id?: string };
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!body.notification_id) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notification } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, body, type")
          .eq("id", body.notification_id)
          .maybeSingle();
        if (!notification) return Response.json({ sent: 0, reason: "not_found" });

        const { data: prefs } = await supabaseAdmin
          .from("notification_preferences")
          .select("inapp_enabled")
          .eq("user_id", notification.user_id)
          .maybeSingle();
        if (prefs && prefs.inapp_enabled === false) {
          return Response.json({ sent: 0, reason: "disabled" });
        }

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", notification.user_id);
        if (!subs || subs.length === 0) return Response.json({ sent: 0, reason: "no_devices" });

        const message = {
          data: {
            title: notification.title,
            body: notification.body ?? "",
            url: TYPE_URL[notification.type] ?? "/dashboard",
            tag: notification.id,
          },
          options: { ttl: 60 * 60 * 24, urgency: "high" as const },
        };

        let sent = 0;
        const stale: string[] = [];

        await Promise.all(
          subs.map(async (sub) => {
            const subscription = {
              endpoint: sub.endpoint,
              expirationTime: null,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            try {
              const payload = await buildPushPayload(message, subscription, vapid);
              const res = await fetch(sub.endpoint, {
                method: payload.method,
                headers: payload.headers as Record<string, string>,
                body: payload.body as unknown as BodyInit,
              });
              if (res.status === 404 || res.status === 410) {
                stale.push(sub.id);
              } else if (res.ok) {
                sent += 1;
              } else {
                console.error("[push] failed", res.status, await res.text().catch(() => ""));
              }
            } catch (error) {
              console.error("[push] error", error);
            }
          }),
        );

        if (stale.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
        }
        if (sent > 0) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString() })
            .eq("user_id", notification.user_id);
        }

        return Response.json({ sent, removed: stale.length });
      },
    },
  },
});
