"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useSite } from "./SiteContext";

/** Review form: star rating + a few words. Held for approval before it appears on the site. */
export function ReviewModal({ onClose, initialRating = 0, dish, orderId }: { onClose: () => void; initialRating?: number; dish?: string; orderId?: string }) {
  const { user, profile } = useAuth();
  const { menu } = useSite();
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [quote, setQuote] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dishName, setDishName] = useState(dish ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // "Priya Sharma" → "Priya S." — friendly but private.
    const n = (profile?.name ?? "").trim().split(/\s+/);
    if (n[0] && !name) setName(n.length > 1 ? `${n[0]} ${n[n.length - 1]![0]}.` : n[0]);
  }, [profile, name]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function submit() {
    setErr(null);
    if (!rating) return setErr("Tap a star rating first");
    if (quote.trim().length < 20) return setErr("Tell us a little more — at least 20 characters");
    setBusy(true);
    try {
      await api("/api/reviews", { rating, quote: quote.trim(), name: name.trim(), location: location.trim() || undefined, dish: dishName || undefined, orderId });
      setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const words = ["", "Not great", "Could be better", "Good", "Really good", "Loved it!"];
  const field = "w-full rounded-2xl border-0 bg-white px-4 py-3 text-[15px] ring-1 ring-ink/10 outline-none focus:ring-2 focus:ring-leaf-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center" onClick={onClose} role="dialog" aria-modal aria-label="Write a review">
      <div className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-cream-50 p-6 text-ink pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl">{done ? "Thank you! 💚" : "How was your Leafli bowl?"}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-ink/5" aria-label="Close"><X className="size-4" /></button>
        </div>

        {done ? (
          <>
            <p className="mt-3 text-ink/70">Your review is with our team and will appear on the site once it&apos;s approved. It really helps a small kitchen like ours.</p>
            <button onClick={onClose} className="tap mt-6 w-full rounded-full bg-leaf-700 py-3.5 font-semibold text-cream-50">Done</button>
          </>
        ) : !user ? (
          <div className="mt-5 rounded-3xl bg-lime-300/50 p-6 text-center">
            <p className="font-semibold">Sign in to leave a review</p>
            <p className="mt-1 text-sm text-ink/60">Reviews come from customers who&apos;ve ordered, so they&apos;re genuine.</p>
            <Link href="/login?next=/%23reviews" className="tap mt-4 inline-flex rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">Sign in</Link>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating" onPointerLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onPointerEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    className="tap p-1"
                  >
                    <Star className={`size-9 transition-colors ${(hover || rating) >= n ? "fill-mango text-mango" : "text-ink/20"}`} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
              <p className="mt-1 h-5 text-sm font-medium text-leaf-700">{words[hover || rating]}</p>
            </div>
            <textarea className={field} rows={4} maxLength={500} placeholder="What did you love? How was the freshness, the dressing, the delivery?" value={quote} onChange={(e) => setQuote(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className={field} placeholder="Name shown (e.g. Priya S.)" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={field} placeholder="Area (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <select className={field} value={dishName} onChange={(e) => setDishName(e.target.value)}>
              <option value="">Which bowl? (optional)</option>
              {menu.items.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            {err && <p role="alert" className="rounded-xl bg-tomato/10 px-3 py-2 text-sm text-tomato">{err}</p>}
            <button onClick={submit} disabled={busy} className="tap w-full rounded-full bg-leaf-700 py-4 font-semibold text-cream-50 disabled:opacity-60">
              {busy ? "Sending…" : "Submit review"}
            </button>
            <p className="text-center text-xs text-ink/45">Reviews appear after a quick check by our team. We never edit what you write.</p>
          </div>
        )}
      </div>
    </div>
  );
}
