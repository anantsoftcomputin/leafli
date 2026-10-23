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
  const [iosHelp, setIosHelp] = useState(false);
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

  const openInstall = useCallback(() => {
    if (deferred) void install();
    else setIosHelp(true);
  }, [deferred, install]);

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
      {iosHelp && <IosInstallSheet onClose={() => setIosHelp(false)} isIOS={isIOS} />}
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

/** iPhone/iPad have no install prompt — show the three taps instead. */
function IosInstallSheet({ onClose, isIOS }: { onClose: () => void; isIOS: boolean }) {
  const steps = isIOS
    ? [
        { icon: <ShareIcon />, text: <>Tap <b>Share</b> in Safari&apos;s toolbar</> },
        { icon: <span className="text-xl leading-none">＋</span>, text: <>Choose <b>Add to Home Screen</b></> },
        { icon: <span className="font-bold">✓</span>, text: <>Tap <b>Add</b> — Leafli appears on your home screen</> },
      ]
    : [
        { icon: <span className="font-bold">⋮</span>, text: <>Open your browser menu</> },
        { icon: <span className="text-xl leading-none">＋</span>, text: <>Choose <b>Install app</b> or <b>Add to Home screen</b></> },
        { icon: <span className="font-bold">✓</span>, text: <>Confirm — Leafli appears with your other apps</> },
      ];
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center" onClick={onClose} role="dialog" aria-modal aria-label="Install Leafli">
      <div className="w-full max-w-md rounded-t-[2rem] bg-cream-50 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" />
        <div className="flex items-center gap-4">
          <img src="/icons/icon-192.png" alt="" className="size-16 rounded-2xl shadow-lg" />
          <div>
            <h2 className="font-display text-2xl">Install Leafli</h2>
            <p className="text-sm text-ink/60">One tap to order, live tracking and alerts.</p>
          </div>
        </div>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-ink/5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-leaf-900">{s.icon}</span>
              <span className="text-[15px] text-ink/80">{s.text}</span>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="tap mt-6 w-full rounded-full bg-leaf-700 py-3.5 font-semibold text-cream-50">Got it</button>
      </div>
    </div>
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
