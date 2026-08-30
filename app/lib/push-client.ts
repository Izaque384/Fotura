import { createClient } from "./supabase-client";

const PUSH_PREF_KEY = "fotura_push_enabled";

export function notificacoesPushAtivadas(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(PUSH_PREF_KEY) !== "false";
}

export function definirPreferenciaPush(ativa: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PUSH_PREF_KEY, ativa ? "true" : "false");
}

/** Registra o Service Worker e inscreve o navegador em push notifications.
 * Retorna true se inscreveu (ou já estava inscrito), false se negou/falhou. */
export async function inscreverPush(userId: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!notificacoesPushAtivadas()) return false;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || session.user.id !== userId) return false;

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
      });
    }

    const keys = sub.toJSON().keys;
    if (!keys?.p256dh || !keys.auth) return false;

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });

    if (res.ok) definirPreferenciaPush(true);
    return res.ok;
  } catch {
    return false;
  }
}

export async function desinscreverPush(userId: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    definirPreferenciaPush(false);
    return true;
  }

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || session.user.id !== userId) return false;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const res = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (!res.ok) return false;
      await sub.unsubscribe();
    }
    definirPreferenciaPush(false);
    return true;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
