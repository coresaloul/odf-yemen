/* Service worker for device notifications (web + mobile), works while the app/browser is closed */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* Web Push: يعمل حتى لو كان التطبيق مغلقاً أو في الخلفية */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "إشعار جديد", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "إشعار جديد";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/favicon.png",
      badge: "/favicon.png",
      dir: "rtl",
      lang: "ar",
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      requireInteraction: true,
      data: { url: payload.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

/* إعادة الاشتراك تلقائياً عند تبديل المتصفح لمفاتيح الدفع (بدون فتح التطبيق) */
function base64UrlToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function bufferToBase64Url(buffer) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint =
        (event.oldSubscription && event.oldSubscription.endpoint) ||
        (await self.registration.pushManager.getSubscription().then((s) => (s ? s.endpoint : null)));

      let sub = event.newSubscription || null;
      if (!sub) {
        const res = await fetch("/api/public/push/vapid");
        const { publicKey } = await res.json();
        if (!publicKey) return;
        sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        });
      }
      if (!sub || !oldEndpoint) return;

      await fetch("/api/public/push/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldEndpoint,
          endpoint: sub.endpoint,
          p256dh: bufferToBase64Url(sub.getKey("p256dh")),
          auth: bufferToBase64Url(sub.getKey("auth")),
        }),
      });
    })(),
  );
});
