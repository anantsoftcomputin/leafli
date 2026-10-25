"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellRing, Check, VolumeX } from "lucide-react";
import { Button } from "@/components/ui";
import { SOURCE_LABEL, timeAgo } from "@/components/OrderBits";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";

const SILENCED_KEY = "leafli-ring-silenced";

let ctx: AudioContext | null = null;
const audio = () => {
  try {
    ctx ??= new AudioContext();
  } catch {}
  return ctx;
};

/** One "ring-ring" of a classic phone bell: two short trilling bursts (no audio file needed). */
function ringOnce(c: AudioContext) {
  [0, 0.55].forEach((offset) => {
    const t = c.currentTime + offset;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    for (let i = 0; i < 10; i++) o.frequency.setValueAtTime(i % 2 ? 1450 : 1150, t + i * 0.04);
    o.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.setValueAtTime(0.5, t + 0.38);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.start(t);
    o.stop(t + 0.44);
  });
}

/**
 * Rings like an incoming call while any website / Zomato order is waiting to be accepted,
 * on every staff device with the app open. Stops everywhere the moment anyone accepts.
 */
export function OrderRinger({ orders }: { orders: Order[] }) {
  const [silenced, setSilenced] = useState<string[]>([]);
  const [muted, setMuted] = useState(false); // browser blocked sound until the first tap
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ringing = orders.filter((o) => !silenced.includes(o.id)).sort((a, b) => a.createdAt - b.createdAt);
  const current = ringing[0];
  const ringingId = current?.id;
  const active = useRef(false);
  active.current = !!current;

  useEffect(() => {
    try {
      setSilenced(JSON.parse(sessionStorage.getItem(SILENCED_KEY) || "[]"));
    } catch {}
  }, []);

  // Browsers only allow sound after the user has interacted with the page once.
  useEffect(() => {
    const unlock = () => {
      audio()?.resume().then(() => setMuted(false)).catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!ringingId) return;
    const tick = () => {
      if (!active.current) return;
      const c = audio();
      if (c && c.state === "suspended") c.resume().catch(() => {});
      setMuted(!c || c.state !== "running");
      if (c?.state === "running") ringOnce(c);
      navigator.vibrate?.([400, 150, 400]);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      clearInterval(id);
      navigator.vibrate?.(0);
    };
  }, [ringingId]);

  if (!current) return null;

  const silence = (id: string) =>
    setSilenced((s) => {
      const next = [...s, id];
      try {
        sessionStorage.setItem(SILENCED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/orders/${current.id}/status`, { status: "accepted" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-leaf-950/90 p-4 backdrop-blur-sm" role="alertdialog" aria-modal aria-labelledby="ringer-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-lime-400/60" />
          <span className="relative grid size-20 place-items-center rounded-full bg-lime-400 text-leaf-950">
            <BellRing className="size-9 animate-[wiggle_1s_ease-in-out_infinite]" />
          </span>
        </div>
        <h2 id="ringer-title" className="mt-5 text-xl font-bold text-stone-900">
          New {SOURCE_LABEL[current.source]} order
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          #{current.orderNo.slice(-3)} · ₹{Math.round(current.total)} · {timeAgo(current.createdAt)}
          {ringing.length > 1 && <span className="font-semibold text-tomato"> · +{ringing.length - 1} more waiting</span>}
        </p>
        <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto rounded-2xl bg-stone-50 p-3 text-left text-sm text-stone-700">
          {current.lines.map((l, i) => (
            <li key={i}>
              <span className="font-semibold">{l.qty}×</span> {l.name}
              {l.notes && <span className="text-stone-400"> — {l.notes}</span>}
            </li>
          ))}
        </ul>
        {muted && <p className="mt-3 text-xs font-semibold text-amber-700">Sound is blocked by the browser — tap anywhere to turn the ringer on.</p>}
        {err && <p className="mt-3 text-xs font-semibold text-red-600">{err}</p>}
        <Button variant="lime" className="mt-5 h-12 w-full text-base" loading={busy} onClick={accept}>
          <Check className="size-5" /> Accept order
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link href={`/admin/orders/${current.id}`} onClick={() => silence(current.id)} className="flex h-10 items-center justify-center rounded-xl bg-white text-sm font-semibold text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50">
            View order
          </Link>
          <Button variant="ghost" onClick={() => silence(current.id)}>
            <VolumeX className="size-4" /> Silence
          </Button>
        </div>
      </div>
    </div>
  );
}
