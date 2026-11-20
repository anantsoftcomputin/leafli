"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Plus, X } from "lucide-react";
import { cartKey, compatibleAddonIds, parseCartKey, resolveSelection } from "@/lib/menu-options";
import { rupees } from "@/lib/costing";
import { DietDot } from "@/components/DietDot";
import { DishImage } from "./DishImage";
import { useSite, type PublicItem } from "./SiteContext";
import { useBodyScrollLock } from "./scroll-lock";

/** Native top-layer dialog: card transforms, carousels and sticky bars cannot clip it. */
export function DishOptions({ item, previousKey, onClose }: { item: PublicItem; previousKey?: string; onClose: () => void }) {
  const { cart, saveCartLine, kitchen } = useSite();
  const initial = previousKey ? parseCartKey(previousKey) : undefined;
  const [variantId, setVariantId] = useState(() => initial?.variantId ?? (item.variants?.find((v) => v.available && v.price === item.price) ?? item.variants?.find((v) => v.available))?.id);
  const [addonIds, setAddonIds] = useState<string[]>(initial?.addonIds ?? []);
  const [qty, setQty] = useState(() => previousKey ? cart[previousKey] ?? 1 : 1);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  useBodyScrollLock(true);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const el = dialog.current!;
    const opener = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const chosen = useMemo(() => {
    try { return { value: resolveSelection(item, { variantId, addonIds }), error: null }; }
    catch (e) { return { value: null, error: (e as Error).message }; }
  }, [item, variantId, addonIds]);
  const variant = item.variants?.find((v) => v.id === variantId);
  const groups = (item.addonGroups ?? []).filter((g) => !variant?.addonGroupIds || variant.addonGroupIds.includes(g.id));
  const row = "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf-600";
  const selectedStyle = "border-leaf-600 bg-leaf-50";
  const normalStyle = "border-ink/10 bg-white hover:border-leaf-400";

  function save() {
    if (!chosen.value || !kitchen.open || !item.available) return;
    try {
      saveCartLine(cartKey(item.id, { variantId, addonIds }), qty, previousKey);
      onClose();
    } catch (e) { setError((e as Error).message); }
  }

  return createPortal(
    <dialog data-dish-options ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(e) => { e.preventDefault(); closeRef.current(); }}
      onKeyDown={(e) => { if (e.key === "Escape") e.stopPropagation(); }}
      onClick={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[1.75rem] border-0 bg-cream-50 p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm sm:inset-0 sm:m-auto sm:max-h-[min(90dvh,52rem)] sm:max-w-lg sm:rounded-3xl">
      <div className="flex max-h-[92dvh] flex-col sm:max-h-[min(90dvh,52rem)]">
        <header className="relative flex shrink-0 items-center gap-3 border-b border-ink/10 p-5 pr-16">
          <span data-options-photo className="shrink-0"><DishImage id={item.id} src={item.imageUrl} alt="" className="size-14" /></span>
          <div className="min-w-0"><p data-options-eyebrow className="mb-1 text-xs font-semibold tracking-wider text-leaf-700 uppercase">{previousKey ? "Edit your bowl" : "Make it yours"}</p><h2 id={titleId} className="font-display text-xl leading-tight font-medium">{item.name}</h2><p data-options-description id={descriptionId} className="mt-1 text-sm text-ink/60">Choose your bowl, then add any extras.</p></div>
          <button autoFocus type="button" aria-label="Close options" onClick={onClose} className="absolute top-4 right-3 grid size-11 place-items-center rounded-full bg-ink/5 hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-leaf-600"><X className="size-5" /></button>
        </header>
        <div data-options-scroll className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
          {!!item.variants?.length && <fieldset className="space-y-2">
            <legend className="mb-3 text-base font-semibold">{item.variants.some((v) => v.name === "Classic" || v.name === "Royale") ? "Choose your size" : "Choose your option"}<span className="ml-2 text-sm font-normal text-ink/50">Choose one</span></legend>
            {item.variants.map((v) => <label key={v.id} className={`${row} ${variantId === v.id ? selectedStyle : normalStyle} ${!v.available ? "cursor-not-allowed opacity-50" : ""}`}>
              <input type="radio" className="size-5 shrink-0 accent-leaf-700" name={`${titleId}-variant`} checked={variantId === v.id} disabled={!v.available} onChange={() => { setVariantId(v.id); setAddonIds((ids) => compatibleAddonIds(item, v.id, ids)); setError(null); }} />
              <span className="min-w-0 flex-1 text-base font-medium">{v.name}{!v.available && <small className="block text-ink/50">Sold out</small>}</span><span className="shrink-0 text-base font-semibold tabular-nums">{rupees(v.price)}</span>
            </label>)}
          </fieldset>}
          {groups.map((g) => {
            const selectedCount = g.options.filter((a) => addonIds.includes(a.id)).length;
            return <fieldset key={g.id} className="space-y-2">
              <legend className="mb-3 text-base font-semibold">{g.name}<span className="ml-2 text-sm font-normal text-ink/50">{g.min ? `Choose ${g.min === g.max ? g.min : `${g.min}–${g.max}`}` : g.max === 1 ? "Optional · choose one" : `Optional · up to ${g.max}`}</span></legend>
              {g.min === 0 && g.max === 1 && <label className={`${row} ${selectedCount === 0 ? selectedStyle : normalStyle}`}>
                <input className="size-5 shrink-0 accent-leaf-700" type="radio" name={`${titleId}-${g.id}`} checked={selectedCount === 0} onChange={() => { setAddonIds((ids) => ids.filter((id) => !g.options.some((a) => a.id === id))); setError(null); }} /><span className="flex-1 text-base">No extras</span><span className="text-sm text-ink/50">Included</span>
              </label>}
              {g.options.map((a) => {
                const checked = addonIds.includes(a.id);
                const disabled = !a.available || (!checked && g.max > 1 && selectedCount >= g.max);
                return <label key={a.id} className={`${row} ${checked ? selectedStyle : normalStyle} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
                  <input type={g.max === 1 ? "radio" : "checkbox"} className="size-5 shrink-0 accent-leaf-700" name={`${titleId}-${g.id}`} checked={checked} disabled={disabled} onChange={(e) => {
                    setAddonIds((ids) => e.target.checked ? [...(g.max === 1 ? ids.filter((id) => !g.options.some((o) => o.id === id)) : ids), a.id] : ids.filter((id) => id !== a.id)); setError(null);
                  }} />
                  <span className="min-w-0 flex-1"><span className="flex items-start gap-2 text-base font-medium"><DietDot diet={a.diet} />{a.name}</span>{a.allergens.length > 0 && <small className="mt-1 block text-sm text-ink/55">Contains {a.allergens.join(", ")}</small>}{!a.available && <small className="block text-sm text-ink/50">Sold out</small>}</span>
                  <span className="shrink-0 text-base font-semibold tabular-nums">+{rupees(a.price)}</span>
                </label>;
              })}
            </fieldset>;
          })}
          {!groups.length && <p className="text-sm text-ink/60">No extra add-ons for this option. Your bowl comes with its usual ingredients.</p>}
        </div>
        <footer className="shrink-0 space-y-3 border-t border-ink/10 bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Quantity</p>{chosen.value && <p className="mt-0.5 text-sm text-ink/55">{rupees(chosen.value.unitPrice)} per bowl · extras included</p>}</div><div className="inline-flex shrink-0 items-center rounded-full border border-ink/15">
            <button type="button" aria-label="Decrease bowl quantity" disabled={qty <= 1} onClick={() => { setQty((q) => q - 1); setError(null); }} className="grid size-11 place-items-center rounded-full text-leaf-700 disabled:opacity-30"><Minus className="size-4" /></button><span aria-live="polite" aria-label={`Quantity ${qty}`} className="min-w-7 text-center font-semibold tabular-nums">{qty}</span><button type="button" aria-label="Increase bowl quantity" disabled={qty >= 20} onClick={() => { setQty((q) => q + 1); setError(null); }} className="grid size-11 place-items-center rounded-full text-leaf-700 disabled:opacity-30"><Plus className="size-4" /></button>
          </div></div>
          {(error || chosen.error) && <p role="alert" className="text-sm text-tomato">{error || chosen.error}</p>}
          {!kitchen.open && <p className="text-sm text-ink/60">{kitchen.message}</p>}
          <button type="button" data-save-options disabled={!chosen.value || !kitchen.open || !item.available} onClick={save} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-full bg-leaf-700 px-5 py-3 text-base font-semibold text-white hover:bg-leaf-800 disabled:opacity-50"><span className="flex items-center gap-2">{previousKey ? <Check className="size-4" /> : <Plus className="size-4" />}{previousKey ? "Save changes" : "Add to bowl"}</span><span className="tabular-nums">{chosen.value ? rupees(chosen.value.unitPrice * qty) : "Choose options"}</span></button>
        </footer>
      </div>
    </dialog>, document.body,
  );
}
