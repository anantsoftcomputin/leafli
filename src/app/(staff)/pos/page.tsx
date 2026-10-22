"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { computeBill } from "@/lib/billing";
import { inr, portionsAvailable } from "@/lib/costing";
import { useItems, useMenu, useSettings } from "@/lib/hooks";
import type { Address, Channel, DeliveryInfo, MenuItem, Order } from "@/lib/types";
import { Badge, Button, ErrorText, Field, Input, PageHeader, Select, cx } from "@/components/ui";
import { DietDot } from "@/components/DietDot";
import { AddressForm, emptyAddress } from "@/components/AddressForm";

type CartLine = { menuItemId: string; qty: number; notes?: string; unitPriceOverride?: number };

export default function PosPage() {
  const router = useRouter();
  const { data: menu } = useMenu();
  const { map: items } = useItems();
  const settings = useSettings();

  const [source, setSource] = useState<Exclude<Channel, "website">>("pos");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [delivery, setDelivery] = useState<DeliveryInfo["provider"]>("pickup");
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<Order["paymentMode"]>("upi");
  const [externalId, setExternalId] = useState("");
  const [notes, setNotes] = useState("");
  const [cat, setCat] = useState("All");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const visible = useMemo(
    () => menu.filter((m) => m.channels?.[source]).sort((a, b) => a.sortOrder - b.sortOrder),
    [menu, source],
  );
  const cats = ["All", ...new Set(visible.map((m) => m.category))];
  const byId = new Map(menu.map((m) => [m.id, m]));

  const priceOf = (m: MenuItem, l?: CartLine) => l?.unitPriceOverride ?? m.channelPrice?.[source] ?? m.price;
  const bill = computeBill(
    {
      source,
      lines: cart.map((l) => ({ unitPrice: priceOf(byId.get(l.menuItemId)!, l), qty: l.qty })),
      discount,
      delivery: delivery === "porter" || delivery === "self",
    },
    settings,
  );

  function add(m: MenuItem) {
    setCart((c) => {
      const i = c.findIndex((l) => l.menuItemId === m.id);
      if (i < 0) return [...c, { menuItemId: m.id, qty: 1 }];
      return c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
    });
  }
  const setQty = (id: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.menuItemId !== id) : c.map((l) => (l.menuItemId === id ? { ...l, qty } : l))));

  function switchSource(s: typeof source) {
    setSource(s);
    setPayment(s === "zomato" ? "zomato" : "upi");
    setDelivery(s === "zomato" ? "zomato" : "pickup");
  }

  async function submit() {
    setErr(null);
    if (!cart.length) return setErr("Add at least one item");
    if (source === "zomato" && !externalId.trim()) return setErr("Enter the Zomato order ID");
    if ((delivery === "porter" || delivery === "self") && (!address.line1 || !address.pincode))
      return setErr("Enter the delivery address");
    setBusy(true);
    try {
      const order = await api<{ id: string }>("/api/orders", {
        source,
        externalId: source === "zomato" ? externalId.trim() : null,
        customer: {
          name: customer.name || (source === "zomato" ? "Zomato customer" : "Walk-in"),
          phone: customer.phone || undefined,
          address: delivery === "porter" || delivery === "self" ? address : null,
        },
        lines: cart,
        discount,
        paymentMode: payment,
        deliveryProvider: delivery,
        notes: notes || undefined,
      });
      router.push(`/orders/${order.id}?print=1`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Billing"
        sub="Punch in walk-in, phone and Zomato orders. Stock is deducted as soon as a POS bill is saved."
        actions={
          <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
            {(["pos", "zomato"] as const).map((s) => (
              <button
                key={s}
                onClick={() => switchSource(s)}
                className={cx("rounded-md px-3 py-1.5", source === s ? "bg-leaf-700 text-white" : "text-stone-600")}
              >
                {s === "pos" ? "Counter / phone" : "Zomato (manual)"}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs",
                  cat === c ? "border-leaf-700 bg-leaf-700 text-white" : "border-stone-300 bg-white text-stone-600",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible
              .filter((m) => cat === "All" || m.category === cat)
              .map((m) => {
                const can = portionsAvailable(m, items);
                const off = !m.available;
                return (
                  <button
                    key={m.id}
                    disabled={off}
                    onClick={() => add(m)}
                    className="flex flex-col rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-leaf-500 hover:shadow-sm disabled:opacity-40"
                  >
                    <div className="flex items-start gap-2">
                      <DietDot diet={m.diet} />
                      <span className="text-sm font-medium leading-tight">{m.name}</span>
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <span className="font-semibold">{inr(priceOf(m))}</span>
                      {off ? (
                        <Badge tone="red">Off</Badge>
                      ) : (
                        <Badge tone={can <= 0 ? "red" : can < 5 ? "amber" : "gray"} title="Portions current stock supports">
                          {can} left
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="space-y-2">
            {cart.length === 0 && <p className="text-sm text-stone-500">Tap items to add them.</p>}
            {cart.map((l) => {
              const m = byId.get(l.menuItemId)!;
              return (
                <div key={l.menuItemId} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{m.name}</div>
                    {source === "zomato" ? (
                      <input
                        className="w-24 rounded border border-stone-200 px-1 text-xs"
                        type="number"
                        placeholder={String(priceOf(m))}
                        title="Price on Zomato"
                        value={l.unitPriceOverride ?? ""}
                        onChange={(e) =>
                          setCart((c) =>
                            c.map((x) =>
                              x.menuItemId === l.menuItemId
                                ? { ...x, unitPriceOverride: e.target.value === "" ? undefined : Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    ) : (
                      <div className="text-xs text-stone-500">{inr(priceOf(m, l))}</div>
                    )}
                  </div>
                  <div className="flex items-center rounded-lg border border-stone-200">
                    <button className="px-2 py-1" onClick={() => setQty(l.menuItemId, l.qty - 1)}>−</button>
                    <span className="w-6 text-center tabular-nums">{l.qty}</span>
                    <button className="px-2 py-1" onClick={() => setQty(l.menuItemId, l.qty + 1)}>+</button>
                  </div>
                  <span className="w-16 text-right tabular-nums">{inr(priceOf(m, l) * l.qty)}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
            {source === "zomato" && (
              <div className="col-span-2">
                <Field label="Zomato order ID">
                  <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} />
                </Field>
              </div>
            )}
            <Field label="Customer name">
              <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </Field>
            <Field label="Fulfilment">
              <Select value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryInfo["provider"])}>
                {source === "zomato" && <option value="zomato">Zomato rider</option>}
                <option value="pickup">Pickup</option>
                <option value="porter">Porter delivery</option>
                <option value="self">Own delivery</option>
              </Select>
            </Field>
            <Field label="Payment">
              <Select value={payment} onChange={(e) => setPayment(e.target.value as Order["paymentMode"])}>
                {source === "zomato" ? (
                  <option value="zomato">Paid on Zomato</option>
                ) : (
                  <>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="pay_later">Pay later</option>
                  </>
                )}
              </Select>
            </Field>
            {(delivery === "porter" || delivery === "self") && (
              <div className="col-span-2">
                <AddressForm value={address} onChange={setAddress} />
              </div>
            )}
            <Field label="Discount (₹)">
              <Input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Kitchen note">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <dl className="space-y-1 border-t border-stone-100 pt-3 text-sm">
            <Row k="Subtotal" v={inr(bill.subtotal)} />
            {bill.discount > 0 && <Row k="Discount" v={`− ${inr(bill.discount)}`} />}
            {bill.packagingCharge > 0 && <Row k="Packaging" v={inr(bill.packagingCharge)} />}
            {bill.deliveryCharge > 0 && <Row k="Delivery" v={inr(bill.deliveryCharge)} />}
            {bill.gstCollectedByAggregator ? (
              <Row k="GST" v="Paid by Zomato (s.9(5))" />
            ) : (
              <>
                <Row k={`CGST ${settings.gstRate / 2}%`} v={inr(bill.cgst)} />
                <Row k={`SGST ${settings.gstRate / 2}%`} v={inr(bill.sgst)} />
              </>
            )}
            {bill.roundOff !== 0 && <Row k="Round off" v={inr(bill.roundOff)} />}
            <div className="flex justify-between pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{inr(bill.total)}</span>
            </div>
          </dl>
          <ErrorText>{err}</ErrorText>
          <Button className="w-full" onClick={submit} loading={busy} disabled={!cart.length}>
            Save & print bill
          </Button>
        </aside>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-stone-600">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
