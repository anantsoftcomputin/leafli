"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { gsap } from "@/lib/gsap";
import { usePwa } from "./PwaProvider";

const SNOOZE = "leafli-install-snooze";
const SEEN = "leafli-install-guide-seen";

/**
 * Install nudges for phones:
 *  - first visit: after a few seconds, open the "Install the Leafli app" guide
 *  - later visits: a compact banner that opens the same guide
 * Never shown inside the installed app; "x" snoozes for 3 days.
 */
export function InstallBanner() {
  const { canInstall, isStandalone, openInstall } = usePwa();
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    if (isStandalone) return;
    const phone = window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024;
    if (!phone && !canInstall) return;
    let snoozed = false;
    let seen = false;
    try {
      snoozed = Number(localStorage.getItem(SNOOZE) || 0) > Date.now();
      seen = localStorage.getItem(SEEN) === "1";
    } catch {}
    if (snoozed) return;
    const t = setTimeout(
      () => {
        if (!seen && phone) {
          openInstall();
          try {
            localStorage.setItem(SEEN, "1");
          } catch {}
        } else setBanner(true);
      },
      seen ? 8000 : 5000,
    );
    return () => clearTimeout(t);
  }, [isStandalone, canInstall, openInstall]);

  useEffect(() => {
    if (banner) gsap.fromTo("[data-install-banner]", { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out" });
  }, [banner]);

  if (!banner || isStandalone) return null;
  const snooze = () => {
    setBanner(false);
    try {
      localStorage.setItem(SNOOZE, String(Date.now() + 3 * 86400000));
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
          setBanner(false);
          openInstall();
        }}
        className="tap flex items-center gap-1.5 rounded-full bg-lime-400 px-3.5 py-2 text-sm font-bold text-leaf-900"
      >
        <Download className="size-4" /> Install
      </button>
      <button onClick={snooze} className="grid size-8 place-items-center rounded-full text-cream-50/60 hover:bg-white/10" aria-label="Not now">
        <X className="size-4" />
      </button>
    </div>
  );
}
