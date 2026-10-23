"use client";

import { useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { usePwa } from "./PwaProvider";

const COPY = {
  order: { title: "Get live order updates", body: "We'll notify you when your bowl is confirmed, packed and on the way.", cta: "Turn on notifications" },
  account: { title: "Notifications", body: "Order updates, subscription reminders and the occasional new-bowl announcement.", cta: "Turn on" },
  staff: { title: "New-order alerts on this device", body: "Get a notification the moment a website or Zomato order comes in — even when this tab is closed.", cta: "Enable alerts" },
} as const;

/** Explains push and asks permission only when the user taps — never on page load. */
export function PushOptIn({ variant, tone = "light" }: { variant: keyof typeof COPY; tone?: "light" | "admin" }) {
  const { push, enablePush, disablePush, sendTestPush, openInstall } = usePwa();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const c = COPY[variant];
  if (push === "unsupported") return null;
  if (variant === "order" && push === "subscribed") return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const admin = tone === "admin";
  return (
    <div className={admin ? "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-900/[.06]" : "rounded-[1.5rem] bg-lime-300/50 p-5"}>
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${admin ? "bg-leaf-50 text-leaf-700" : "bg-white text-leaf-700"}`}>
          {push === "subscribed" ? <BellRing className="size-5" /> : push === "denied" ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{c.title}</p>
          <p className="mt-0.5 text-sm text-ink/60">
            {push === "denied"
              ? "Notifications are blocked for this site. Allow them in your browser or phone settings, then come back."
              : push === "needs-install"
                ? "On iPhone, notifications work once Leafli is added to your home screen."
                : push === "subscribed"
                  ? "On for this device."
                  : c.body}
          </p>
          {msg && <p className="mt-1 text-xs text-tomato">{msg}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {push === "needs-install" && (
              <button onClick={openInstall} className="tap rounded-full bg-leaf-700 px-4 py-2 text-sm font-semibold text-cream-50">Add to Home Screen</button>
            )}
            {(push === "default" || push === "unsubscribed") && (
              <button disabled={busy} onClick={() => run(enablePush)} className="tap rounded-full bg-leaf-700 px-4 py-2 text-sm font-semibold text-cream-50 disabled:opacity-60">
                {busy ? "Turning on…" : c.cta}
              </button>
            )}
            {push === "subscribed" && variant !== "order" && (
              <>
                <button disabled={busy} onClick={() => run(async () => { await sendTestPush(); setMsg(null); })} className="tap rounded-full bg-white px-4 py-2 text-sm font-semibold text-leaf-700 ring-1 ring-leaf-700/20">
                  Send a test
                </button>
                <button disabled={busy} onClick={() => run(disablePush)} className="tap rounded-full px-4 py-2 text-sm font-semibold text-ink/50 hover:bg-ink/5">
                  Turn off
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
