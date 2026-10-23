"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PushState = "unsupported" | "needs-install" | "default" | "denied" | "subscribed" | "unsubscribed";

interface PwaState {
  /** Android/desktop: a native install prompt is available. */
  canInstall: boolean;
  /** iPhone/iPad Safari: no prompt exists — show Share → Add to Home Screen. */
  isIOS: boolean;
  isStandalone: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** Native prompt where available, otherwise the iPhone "Add to Home Screen" guide. */
  openInstall: () => void;
  push: PushState;
  enablePush: () => Promise<PushState>;
  disablePush: () => Promise<void>;
  sendTestPush: () => Promise<void>;
}

const Ctx = createContext<PwaState | null>(null);
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setStandalone] = useState(false);
  const [isIOS, setIOS] = useState(false);
  const [push, setPush] = useState<PushState>("unsupported");
  const [guide, setGuide] = useState(false);
  const reloading = useRef(false);

  // ── Register the service worker and watch for updates ──
  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let interval: ReturnType<typeof setInterval> | undefined;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((r) => {
      setReg(r);
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener("statechange", () => {
          // A new version finished installing while an old one controls the page → offer the update.
          if (w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w);
        });
      };
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => track(r.installing));
      const check = () => r.update().catch(() => {});
      interval = setInterval(check, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    });

    const onChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      if (interval) clearInterval(interval);
    };
  }, []);

  // ── Install prompt (Chrome/Edge/Samsung on Android, desktop Chrome) ──
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // ── Current push state ──
  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID;
      if (!supported) return setPush(isIOS && !isStandalone ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return setPush("denied");
      if (!reg) return setPush(Notification.permission === "granted" ? "unsubscribed" : "default");
      const sub = await reg.pushManager.getSubscription();
      if (sub && user) {
        // Keep the server's copy linked to whoever is signed in on this device.
        api("/api/push/subscribe", { subscription: sub.toJSON() }).catch(() => {});
      }
      setPush(sub ? "subscribed" : Notification.permission === "granted" ? "unsubscribed" : "default");
    })();
  }, [reg, user, isIOS, isStandalone]);

  const install = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const openInstall = useCallback(() => setGuide(true), []);

  const enablePush = useCallback(async (): Promise<PushState> => {
    if (!reg || !VAPID) {
      setPush(isIOS && !isStandalone ? "needs-install" : "unsupported");
      return push;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      const s = permission === "denied" ? "denied" : "default";
      setPush(s);
      return s;
    }
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
    await api("/api/push/subscribe", { subscription: sub.toJSON() });
    setPush("subscribed");
    return "subscribed";
  }, [reg, isIOS, isStandalone, push]);

  const disablePush = useCallback(async () => {
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/subscribe", { endpoint: sub.endpoint }, "DELETE").catch(() => {});
      await sub.unsubscribe();
    }
    setPush("unsubscribed");
  }, [reg]);

  const sendTestPush = useCallback(async () => {
    await api("/api/push/test", {});
  }, []);

  return (
    <Ctx.Provider value={{ canInstall: !!deferred, isIOS, isStandalone, install, openInstall, push, enablePush, disablePush, sendTestPush }}>
      {children}
      {guide && (
        <InstallGuide
          canInstall={!!deferred}
          onInstall={async () => {
            const r = await install();
            if (r === "accepted") setGuide(false);
          }}
          onClose={() => setGuide(false)}
        />
      )}
      {waiting && (
        <div role="status" className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-leaf-950 p-3 pl-4 text-sm text-cream-50 shadow-2xl sm:top-auto sm:bottom-6">
          <RefreshCw className="size-4 shrink-0 text-lime-300" />
          <span className="flex-1">A new version of Leafli is ready.</span>
          <button
            onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
            className="rounded-xl bg-lime-400 px-3 py-1.5 text-xs font-bold text-leaf-950"
          >
            Update
          </button>
          <button onClick={() => setWaiting(null)} className="grid size-7 place-items-center rounded-lg text-cream-50/60 hover:bg-white/10" aria-label="Later">
            <X className="size-4" />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function usePwa() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePwa must be used inside PwaProvider");
  return v;
}

type Platform = "ios-safari" | "ios-other" | "android-chrome" | "android-samsung" | "android-other" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) return /SamsungBrowser/i.test(ua) ? "android-samsung" : /Chrome/i.test(ua) ? "android-chrome" : "android-other";
  return "desktop";
}

const STEPS: Record<Platform, { icon: React.ReactNode; text: React.ReactNode }[]> = {
  "ios-safari": [
    { icon: <ShareIcon />, text: <>Tap the <b>Share</b> button at the bottom of Safari</> },
    { icon: <PlusSquare />, text: <>Scroll and tap <b>Add to Home Screen</b></> },
    { icon: <span className="font-bold">✓</span>, text: <>Tap <b>Add</b> — Leafli appears on your home screen</> },
  ],
  "ios-other": [
    { icon: <ShareIcon />, text: <>Tap the <b>Share</b> icon in the address bar</> },
    { icon: <PlusSquare />, text: <>Choose <b>Add to Home Screen</b></> },
    { icon: <span className="font-bold">✓</span>, text: <>Tap <b>Add</b>. (Using Safari? It works there too.)</> },
  ],
  "android-chrome": [
    { icon: <span className="text-xl leading-none font-bold">⋮</span>, text: <>Tap the <b>⋮ menu</b> at the top right</> },
    { icon: <PlusSquare />, text: <>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</> },
    { icon: <span className="font-bold">✓</span>, text: <>Tap <b>Install</b> — Leafli joins your apps</> },
  ],
  "android-samsung": [
    { icon: <span className="text-lg leading-none font-bold">☰</span>, text: <>Tap the <b>☰ menu</b> at the bottom right</> },
    { icon: <PlusSquare />, text: <>Tap <b>Add page to</b> → <b>Home screen</b></> },
    { icon: <span className="font-bold">✓</span>, text: <>Tap <b>Add</b> — Leafli joins your apps</> },
  ],
  "android-other": [
    { icon: <span className="text-xl leading-none font-bold">⋮</span>, text: <>Open your browser menu</> },
    { icon: <PlusSquare />, text: <>Choose <b>Install app</b> or <b>Add to Home screen</b></> },
    { icon: <span className="font-bold">✓</span>, text: <>Confirm — Leafli joins your apps</> },
  ],
  desktop: [
    { icon: <PlusSquare />, text: <>Click the <b>install icon</b> at the right end of the address bar</> },
    { icon: <span className="font-bold">✓</span>, text: <>Click <b>Install</b> — Leafli opens in its own window</> },
  ],
};

const PERKS = ["One-tap ordering", "Live order tracking", "Order alerts", "Works offline"];

/** "Install the Leafli app" sheet: native button when the browser supports it, otherwise exact steps. */
export function InstallGuide({ canInstall, onInstall, onClose }: { canInstall: boolean; onInstall: () => void; onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  useEffect(() => setPlatform(detectPlatform()), []);
  const steps = STEPS[platform];
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center" onClick={onClose} role="dialog" aria-modal aria-label="Install the Leafli app">
      <div className="w-full max-w-md rounded-t-[2rem] bg-cream-50 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" />
        <div className="flex items-center gap-4">
          <img src="/icons/icon-192.png" alt="" className="size-16 rounded-2xl shadow-lg ring-1 ring-ink/5" />
          <div>
            <h2 className="font-display text-2xl leading-tight">Install the Leafli app</h2>
            <p className="text-sm text-ink/60">Free · takes 10 seconds · no app store needed</p>
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-2 text-sm">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2 rounded-xl bg-lime-300/40 px-3 py-2 font-medium text-leaf-900">
              <span className="text-leaf-700">✓</span>
              {p}
            </li>
          ))}
        </ul>
        {canInstall ? (
          <button onClick={onInstall} className="tap mt-6 w-full rounded-full bg-leaf-700 py-4 text-base font-semibold text-cream-50 shadow-lg shadow-leaf-900/20">
            Install now
          </button>
        ) : (
          <>
            <p className="mt-6 text-xs font-semibold tracking-wider text-ink/50 uppercase">How to install</p>
            <ol className="mt-2 space-y-2.5">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-700 text-cream-50">{s.icon}</span>
                  <span className="text-[15px] leading-snug text-ink/80">
                    <span className="mr-1 font-semibold text-leaf-700">{i + 1}.</span>
                    {s.text}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        <button onClick={onClose} className="tap mt-3 w-full rounded-full py-3 text-sm font-semibold text-ink/55 hover:bg-ink/5">
          {canInstall ? "Not now" : "Got it"}
        </button>
      </div>
    </div>
  );
}

function PlusSquare() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
