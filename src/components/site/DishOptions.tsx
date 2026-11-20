"use client";

import { useMemo, useState } from "react";
import { cartKey, resolveSelection } from "@/lib/menu-options";
import { rupees } from "@/lib/costing";
import { Button, ErrorText, Modal } from "@/components/ui";
import { DietDot } from "@/components/DietDot";
import { useSite, type PublicItem } from "./SiteContext";

/** Options belong to one cart line, so two bowls may have different extras. */
export function DishOptions({ item, onClose }: { item: PublicItem; onClose: () => void }) {
  const { add, kitchen } = useSite();
  const [variantId, setVariantId] = useState(() => (item.variants?.find((v) => v.available && v.price === item.price) ?? item.variants?.find((v) => v.available))?.id);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const chosen = useMemo(() => {
    try { return { value: resolveSelection(item, { variantId, addonIds }), error: null }; }
    catch (e) { return { value: null, error: (e as Error).message }; }
  }, [item, variantId, addonIds]);
  const variant = item.variants?.find((v) => v.id === variantId);
  const groups = (item.addonGroups ?? []).filter((g) => !variant?.addonGroupIds || variant.addonGroupIds.includes(g.id));
  return (
    <Modal open onClose={onClose} title={`Customise ${item.name}`}>
      <div className="space-y-5">
        {!!item.variants?.length && <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">Choose your option</legend>
          {item.variants.map((v) => <label key={v.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-stone-50 p-3 text-base">
            <input type="radio" name="dish-variant" checked={variantId === v.id} disabled={!v.available} onChange={() => { setVariantId(v.id); setAddonIds([]); }} />
            <span className="flex-1">{v.name}{!v.available && " · Sold out"}</span><span>{rupees(v.price)}</span>
          </label>)}
        </fieldset>}
        {groups.map((g) => <fieldset key={g.id} className="space-y-2">
          <legend className="mb-2 font-semibold">{g.name} <span className="text-sm font-normal text-stone-500">{g.min ? `Choose ${g.min}–${g.max}` : `Optional · up to ${g.max}`}</span></legend>
          {g.options.map((a) => <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-stone-50 p-3 text-base">
            <input type="checkbox" checked={addonIds.includes(a.id)} disabled={!a.available} onChange={(e) => setAddonIds((ids) => e.target.checked ? [...(g.max === 1 ? ids.filter((id) => !g.options.some((o) => o.id === id)) : ids), a.id] : ids.filter((id) => id !== a.id))} />
            <DietDot diet={a.diet} /><span className="flex-1">{a.name}{a.allergens.length > 0 && <small className="block text-stone-500">Contains {a.allergens.join(", ")}</small>}</span><span>+{rupees(a.price)}</span>
          </label>)}
        </fieldset>)}
        <label className="flex items-center justify-between text-base">Bowls with these choices<input aria-label="Quantity" className="w-20 rounded-lg border p-2" type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></label>
        <ErrorText>{chosen.error}</ErrorText>
        {!kitchen.open && <p className="text-sm text-stone-600">{kitchen.message}</p>}
        <Button className="w-full" disabled={!chosen.value || !kitchen.open} onClick={() => { add(cartKey(item.id, { variantId, addonIds }), qty); onClose(); }}>
          Add to bowl{chosen.value ? ` · ${rupees(chosen.value.unitPrice * qty)}` : ""}
        </Button>
      </div>
    </Modal>
  );
}
