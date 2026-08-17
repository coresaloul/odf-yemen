import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey } from "@/lib/push.functions";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

let swRegistration: ServiceWorkerRegistration | null = null;

async function ensureServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    swRegistration = await navigator.serviceWorker.ready;
    return swRegistration;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function bufferToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** تسجيل الجهاز لدى خدمة الدفع حتى تصل الإشعارات والتطبيق مغلق */
async function subscribeToPush() {
  const reg = await ensureServiceWorker();
  if (!reg || !("pushManager" in reg)) return false;

  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return false;

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return false;

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let sub = await reg.pushManager.getSubscription();

  // إن كان الاشتراك القديم بمفتاح مختلف نُلغيه ونعيد الاشتراك حتى لا تتوقف الإشعارات
  if (sub) {
    const current = bufferToBase64Url(sub.options?.applicationServerKey ?? null);
    if (current && current !== publicKey) {
      await sub.unsubscribe().catch(() => false);
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const p256dh = bufferToBase64Url(sub.getKey("p256dh"));
  const auth = bufferToBase64Url(sub.getKey("auth"));
  if (!p256dh || !auth) return false;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.user.id,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 255),
    },
    { onConflict: "endpoint" },
  );
  return !error;
}


/**
 * إشعارات الجهاز (الويب والموبايل):
 * - Notification API عبر Service Worker لعرض الإشعار على الجهاز
 * - Web Push لاستقبال الإشعارات والتطبيق في الخلفية أو مغلق
 */
export function useDeviceNotifications() {
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [pushReady, setPushReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission as PermissionState);

    const sync = () => {
      if (Notification.permission !== "granted") return;
      void subscribeToPush().then(setPushReady);
    };
    sync();

    // إعادة التحقق من صلاحية اشتراك الجهاز دورياً وعند العودة للتطبيق
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(sync, 6 * 60 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);


  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    const result = (await Notification.requestPermission()) as PermissionState;
    setPermission(result);
    if (result === "granted") setPushReady(await subscribeToPush());
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

  return { permission, request, notify, pushReady, isSupported: permission !== "unsupported" };
}
