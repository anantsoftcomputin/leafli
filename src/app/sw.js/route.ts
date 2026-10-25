// The service worker script. Served from a route (not /public) so the deploy
// version is baked in: any new deploy changes these bytes and browsers pick up
// the update, which the app then offers as "Update available".
export const dynamic = "force-static";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const SCRIPT = `
const VERSION = ${JSON.stringify(VERSION)};
const VAPID = ${JSON.stringify(VAPID)};
const STATIC = "leafli-static-" + VERSION;
const PAGES = "leafli-pages-" + VERSION;
const IMAGES = "leafli-images";
const PRECACHE = ["/icons/icon-192.png", "/icons/badge-96.png", "/brand/leafli-wordmark.png", "/manifest.webmanifest"];
// Self-contained offline screen (no JS chunks needed, so it always renders).
const OFFLINE_HTML = \`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f9f6ea"><title>You're offline · Leafli</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f9f6ea;color:#10231a;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px;box-sizing:border-box}
main{max-width:340px}img{height:80px}h1{font-family:Georgia,serif;font-weight:500;font-size:34px;margin:28px 0 10px}p{color:#10231a99;line-height:1.5;margin:0}
button{margin-top:28px;border:0;border-radius:999px;background:#255f30;color:#fffdf6;font-weight:600;font-size:16px;padding:14px 28px}</style></head>
<body><main><img src="/brand/leafli-wordmark.png" alt="Leafli"><h1>You're offline</h1><p>Check your connection and try again. Pages you've visited recently still open without internet.</p>
<button onclick="location.reload()">Try again</button></main></body></html>\`;
const offlineResponse = () => new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
const PRIVATE = /^\\/(admin|account|login|api)(\\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
  // Don't take over immediately: the page asks the user before activating an update.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC, PAGES, IMAGES];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "GET_VERSION") event.ports[0] && event.ports[0].postMessage(VERSION);
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page navigations: network first, fall back to the last cached copy, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && url.origin === location.origin && !PRIVATE.test(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, 40));
          }
          return res;
        } catch {
          return (await caches.match(req, { ignoreVary: true })) || offlineResponse();
        }
      })(),
    );
    return;
  }

  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/")) return; // always live
    // Hashed build assets never change: cache first.
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
      event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      })));
      return;
    }
  }

  // Images (incl. dish photos in Firebase Storage): show cached instantly, refresh in the background.
  if (req.destination === "image" || url.hostname === "firebasestorage.googleapis.com") {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") { cache.put(req, res.clone()); trim(IMAGES, 80); }
          return res;
        }).catch(() => hit);
        return hit || network;
      }),
    );
  }
});

// ── Push notifications ──
const RING_VIBRATE = [700, 300, 700, 1200, 700, 300, 700, 1200, 700, 300, 700, 1200, 700, 300, 700];
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Leafli";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      image: data.image,
      tag: data.tag,
      renotify: !!data.tag,
      requireInteraction: !!data.requireInteraction,
      // New orders buzz like an incoming call (Android; iOS ignores vibration patterns).
      vibrate: data.ring ? RING_VIBRATE : [80, 40, 80],
      silent: false,
      data: { url: data.url || "/" },
      actions: data.actions || [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === location.origin) {
          await w.focus();
          return w.navigate ? w.navigate(target) : undefined;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

// Browser rotated the push subscription: re-subscribe and tell the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      if (!VAPID) return;
      const key = Uint8Array.from(atob(VAPID.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (VAPID.length % 4)) % 4)), (c) => c.charCodeAt(0));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push/renew", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldEndpoint: event.oldSubscription && event.oldSubscription.endpoint, subscription: sub.toJSON() }),
      });
    })(),
  );
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
}
