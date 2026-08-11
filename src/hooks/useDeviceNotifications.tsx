import { useCallback, useEffect, useState } from "react";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

let swRegistration: ServiceWorkerRegistration | null = null;

async function ensureServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch {
    return null;
  }
}

/**
 * إشعارات الجهاز (الويب والموبايل) عبر Notification API + Service Worker.
 * على أندرويد لا تعمل new Notification() لذلك نستخدم showNotification من الـ SW.
 */
export function useDeviceNotifications() {
  const [permission, setPermission] = useState<PermissionState>("unsupported");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission as PermissionState);
    if (Notification.permission === "granted") void ensureServiceWorker();
  }, []);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    const result = (await Notification.requestPermission()) as PermissionState;
    setPermission(result);
    if (result === "granted") await ensureServiceWorker();
    return result;
  }, []);

  const notify = useCallback(
    async (title: string, options?: { body?: string | null; url?: string; tag?: string }) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const payload = {
        icon: "/favicon.png",
        badge: "/favicon.png",
        dir: "rtl",
        lang: "ar",
        data: { url: options?.url ?? "/dashboard" },
        ...(options?.body ? { body: options.body } : {}),
        ...(options?.tag ? { tag: options.tag } : {}),
      } as NotificationOptions;
      const reg = await ensureServiceWorker();
      if (reg) {
        await reg.showNotification(title, payload);
        return;
      }
      try {
        new Notification(title, payload);
      } catch {
        /* المتصفح لا يدعم الإشعارات المباشرة */
      }
    },
    [],
  );

  return { permission, request, notify, isSupported: permission !== "unsupported" };
}
