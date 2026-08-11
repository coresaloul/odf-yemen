/* Service worker for device notifications (web + mobile) */
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
