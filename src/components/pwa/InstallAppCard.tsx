"use client";

import { Smartphone } from "lucide-react";
import { usePwa } from "./PwaProvider";

/** Account-page card: install the app, or confirm it's installed. */
export function InstallAppCard() {
  const { isStandalone, openInstall } = usePwa();
  return (
    <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-ink/5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-leaf-800"><Smartphone className="size-5" /></span>
        <div>
          <p className="font-semibold text-ink">{isStandalone ? "You're using the app" : "Leafli on your home screen"}</p>
          <p className="mt-0.5 text-sm text-ink/60">{isStandalone ? "Thanks for installing — updates arrive automatically." : "Opens full-screen like an app, with one-tap ordering and order alerts."}</p>
          {!isStandalone && (
            <button onClick={openInstall} className="tap mt-3 rounded-full bg-leaf-700 px-4 py-2 text-sm font-semibold text-cream-50">Install the app</button>
          )}
        </div>
      </div>
    </div>
  );
}
