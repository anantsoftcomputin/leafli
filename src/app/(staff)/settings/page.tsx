"use client";

import { useEffect, useState } from "react";
import { doc, getDocs, collection, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { useLive, useLiveDoc } from "@/lib/hooks";
import { DEFAULT_SETTINGS } from "@/lib/billing";
import type { BusinessSettings, Role, UserProfile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { AddressForm } from "@/components/AddressForm";
import { Badge, Button, Card, ErrorText, Field, Input, PageHeader, Select, Td, Th } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <BusinessCard />
        <TeamCard />
        <IntegrationsCard />
        <SeedCard />
      </div>
    </>
  );
}

function BusinessCard() {
  const { data: stored, loading } = useLiveDoc<BusinessSettings>("settings/business");
  const [f, setF] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!loaded && !loading) {
      setF({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
      setLoaded(true);
    }
  }, [stored, loading, loaded]);
  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => setF({ ...f, [k]: v });
  const num = (k: keyof BusinessSettings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (Number(e.target.value) || 0) as never);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const { id: _id, ...data } = f as BusinessSettings & { id?: string };
      await setDoc(doc(db, "settings", "business"), JSON.parse(JSON.stringify(data)));
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Business, GST & billing" actions={<Button size="sm" onClick={save} loading={busy}>{saved ? "Saved ✓" : "Save"}</Button>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Brand name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Legal name (on invoice)"><Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} /></Field>
        <Field label="GSTIN"><Input value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></Field>
        <Field label="FSSAI licence no."><Input value={f.fssai} onChange={(e) => set("fssai", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="GST rate %" hint="5% for restaurant services without ITC"><Input type="number" value={f.gstRate} onChange={num("gstRate")} /></Field>
        <Field label="Packaging charge / order (₹)" hint="Not applied to Zomato orders"><Input type="number" value={f.packagingChargePerOrder} onChange={num("packagingChargePerOrder")} /></Field>
        <Field label="Default delivery charge (₹)"><Input type="number" value={f.defaultDeliveryCharge} onChange={num("defaultDeliveryCharge")} /></Field>
        <Field label="Zomato commission %" hint="For margin reporting"><Input type="number" value={f.zomatoCommissionPct} onChange={num("zomatoCommissionPct")} /></Field>
        <div className="sm:col-span-2"><Field label="Invoice footer"><Input value={f.invoiceFooter} onChange={(e) => set("invoiceFooter", e.target.value)} /></Field></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
          <input type="checkbox" checked={f.acceptingOrders} onChange={(e) => set("acceptingOrders", e.target.checked)} />
          Accepting website orders (turn off when the kitchen is closed)
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <h4 className="mb-2 text-xs font-medium text-stone-600">Kitchen address (Porter pickup — include coordinates)</h4>
          <AddressForm value={f.address} onChange={(a) => set("address", a)} />
        </div>
      </div>
    </Card>
  );
}

const ROLES: Role[] = ["admin", "manager", "kitchen", "cashier", "customer"];

function TeamCard() {
  const { profile } = useAuth();
  const { data: staff } = useLive<UserProfile & { id: string }>("users", [where("role", "in", ["admin", "manager", "kitchen", "cashier"])]);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<(UserProfile & { id: string })[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function find() {
    setErr(null);
    const s = search.trim();
    const phone = s.replace(/\D/g, "");
    const q = s.includes("@")
      ? query(collection(db, "users"), where("email", "==", s.toLowerCase()))
      : query(collection(db, "users"), where("phone", "==", `+91${phone.slice(-10)}`));
    const r = await getDocs(q);
    setFound(r.docs.map((d) => ({ id: d.id, ...(d.data() as UserProfile) })));
    if (r.empty) setErr("No user found. Ask them to sign in once at /login first.");
  }

  async function setRole(uid: string, role: Role) {
    setErr(null);
    try {
      await api("/api/users/role", { uid, role });
      setFound((f) => f.map((u) => (u.id === uid ? { ...u, role } : u)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const rows = [...staff, ...found.filter((f) => !staff.some((s) => s.id === f.id))];
  return (
    <Card title="Team & roles">
      <p className="mb-3 text-xs text-stone-500">
        <b>Admin</b>: everything. <b>Manager</b>: menu, purchasing, costs, stock counts. <b>Cashier</b>: billing & orders. <b>Kitchen</b>: KDS, batch prep, wastage.
      </p>
      <div className="mb-3 flex gap-2">
        <Input placeholder="Find by email or 10-digit phone" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button variant="secondary" onClick={find}>Find</Button>
      </div>
      <ErrorText>{err}</ErrorText>
      <table className="w-full text-sm">
        <thead><tr><Th>Name</Th><Th>Login</Th><Th>Role</Th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-stone-100">
              <Td>{u.name}</Td>
              <Td className="text-xs text-stone-500">{u.email ?? u.phone}</Td>
              <Td>
                <Select className="w-36" value={u.role} disabled={u.id === profile?.uid} onChange={(e) => setRole(u.id, e.target.value as Role)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

interface Status {
  porter: { configured: boolean; baseUrl: string; webhookConfigured: boolean; webhookUrl: string };
  zomato: { webhookConfigured: boolean; statusCallbackConfigured: boolean; autoAccept: boolean; webhookUrl: string };
  razorpay: { configured: boolean; mode: string; webhookConfigured: boolean; webhookUrl: string };
  website: { menuUrl: string; ordersUrl: string; cors: string };
  logs: { id: string; provider: string; direction: string; at: number; error: string | null; orderId: string | null }[];
}

function IntegrationsCard() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Status>("/api/integrations/status").then(setS).catch((e) => setErr(e.message));
  }, []);
  const ok = (b: boolean) => <Badge tone={b ? "green" : "amber"}>{b ? "configured" : "not configured"}</Badge>;
  return (
    <Card title="Integrations">
      <ErrorText>{err}</ErrorText>
      {s && (
        <div className="grid gap-4 text-sm lg:grid-cols-4">
          <div className="space-y-1">
            <h4 className="font-medium">Porter delivery</h4>
            <div>API key {ok(s.porter.configured)}</div>
            <div>Webhook {ok(s.porter.webhookConfigured)}</div>
            <div className="text-xs text-stone-500">Base: {s.porter.baseUrl}</div>
            <code className="block break-all rounded bg-stone-100 p-1 text-[11px]">{s.porter.webhookUrl}</code>
          </div>
          <div className="space-y-1">
            <h4 className="font-medium">Zomato orders</h4>
            <div>Inbound webhook {ok(s.zomato.webhookConfigured)}</div>
            <div>Status callback {ok(s.zomato.statusCallbackConfigured)}</div>
            <div className="text-xs text-stone-500">Auto-accept: {s.zomato.autoAccept ? "on" : "off"}</div>
            <code className="block break-all rounded bg-stone-100 p-1 text-[11px]">{s.zomato.webhookUrl}</code>
            <p className="text-xs text-stone-500">Until the integration is live, punch Zomato orders in Billing → Zomato (manual).</p>
          </div>
          <div className="space-y-1">
            <h4 className="font-medium">Razorpay payments</h4>
            <div>API keys {ok(s.razorpay.configured)} <span className="text-xs text-stone-500">({s.razorpay.mode})</span></div>
            <div>Webhook {ok(s.razorpay.webhookConfigured)}</div>
            <code className="block break-all rounded bg-stone-100 p-1 text-[11px]">{s.razorpay.webhookUrl}</code>
            <p className="text-xs text-stone-500">Events: payment.captured, order.paid</p>
          </div>
          <div className="space-y-1">
            <h4 className="font-medium">leafli.in website</h4>
            <div className="text-xs">Menu feed:</div>
            <code className="block break-all rounded bg-stone-100 p-1 text-[11px]">GET {s.website.menuUrl}</code>
            <div className="text-xs">Place order (Firebase ID token):</div>
            <code className="block break-all rounded bg-stone-100 p-1 text-[11px]">POST {s.website.ordersUrl}</code>
            <div className="text-xs text-stone-500">CORS: {s.website.cors || "—"}</div>
          </div>
          <div className="lg:col-span-4">
            <h4 className="mb-1 font-medium">Recent integration events</h4>
            <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
              {s.logs.map((l) => (
                <li key={l.id} className="flex gap-2">
                  <span className="text-stone-500">{new Date(l.at).toLocaleString("en-IN")}</span>
                  <span>{l.provider} {l.direction}</span>
                  {l.error ? <span className="text-red-600">{l.error}</span> : <span className="text-stone-500">{l.orderId ?? "ok"}</span>}
                </li>
              ))}
              {!s.logs.length && <li className="text-stone-500">No events yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function SeedCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function seed(overwrite: boolean) {
    if (overwrite && !confirm("Overwrite menu, recipes and item settings with the SOP versions? Stock levels are kept.")) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<Record<string, number>>(`/api/admin/seed${overwrite ? "?overwrite=1" : ""}`, {});
      setMsg(`Loaded ${r.items} items, ${r.menu} dishes, ${r.suppliers} suppliers; recosted ${r.recosted} preps.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="SOP master data">
      <p className="mb-3 text-sm text-stone-600">
        Loads every ingredient, batch prep (dressings, sauces, cooked components) and dish from SOPs LF-KIT-SOP-001 and 003–007, with shelf lives from
        the Practical Shelf-Life Guide. Costs and selling prices are placeholders flagged “est.” until you set them.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => seed(false)} loading={busy}>Load SOP data (keep my edits)</Button>
        <Button variant="secondary" onClick={() => seed(true)} loading={busy}>Reset to SOP versions</Button>
      </div>
      {msg && <p className="mt-2 text-sm text-leaf-700">{msg}</p>}
      <ErrorText>{err}</ErrorText>
    </Card>
  );
}
