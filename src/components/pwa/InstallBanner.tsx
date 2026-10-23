"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { gsap } from "@/lib/gsap";
import { usePwa } from "./PwaProvider";

const KEY = "leafli-install-dismissed";
const VISITS = "leafli-visits";

/**
 * "Get the Leafli app" card for phones. Appears after ~25s or on a return visit,
 * never when already installed, and stays hidden for 14 days once dismissed.
 */
export function InstallBanner() {
  const { canInstall, isIOS, isStandalone, openInstall } = usePwa();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone || (!canInstall && !isIOS)) return;
    let visits = 1;
    try {
      const until = Number(localStorage.getItem(KEY) || 0);
      if (until > Date.now()) return;
      // Count one visit per browser session.
      visits = Number(localStorage.getItem(VISITS) || 0);
      if (!sessionStorage.getItem(VISITS)) {
        visits += 1;
        localStorage.setItem(VISITS, String(visits));
        sessionStorage.setItem(VISITS, "1");
      }
    } catch {}
    const t = setTimeout(() => setShow(true), visits > 1 ? 4000 : 25000);
    return () => clearTimeout(t);
  }, [canInstall, isIOS, isStandalone]);

  useEffect(() => {
    if (show) gsap.fromTo("[data-install-banner]", { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out" });
  }, [show]);

  if (!show || isStandalone) return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now() + 14 * 86400000));
    } catch {}
  };

  return (
    <div data-install-banner className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+10px)] z-30 flex items-center gap-3 rounded-[1.4rem] bg-leaf-800 p-3 text-cream-50 shadow-2xl shadow-leaf-900/30 lg:right-6 lg:bottom-6 lg:left-auto lg:w-96">
      <img src="/icons/icon-192.png" alt="" className="size-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Get the Leafli app</div>
        <div className="text-xs text-cream-50/70">Faster ordering, live tracking & order alerts</div>
      </div>
      <button
        onClick={() => {
          openInstall();
          setShow(false);
        }}
        className="tap flex items-center gap-1.5 rounded-full bg-lime-400 px-3.5 py-2 text-sm font-bold text-leaf-900"
      >
        <Download className="size-4" /> Install
      </button>
      <button onClick={dismiss} className="grid size-8 place-items-center rounded-full text-cream-50/60 hover:bg-white/10" aria-label="Not now">
        <X className="size-4" />
      </button>
    </div>
  );
}
