"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { InvoiceView } from "./InvoiceView";
import type { InvoiceKind, InvoiceRecord } from "@/lib/invoice-record";
import { Button, ErrorText, Field, Input, Textarea } from "./ui";

export function InvoicePage({ kind, id, admin = false }: { kind: InvoiceKind; id: string; admin?: boolean }) {
  const { user, loading, profile } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const load = useCallback(async () => { try { setInvoice(await api<InvoiceRecord>(`/api/invoices/${kind}/${id}`)); setError(null); } catch (e) { setError((e as Error).message); } }, [kind, id]);
  useEffect(() => { if (!loading && user) void load(); }, [loading, user, load]);
  if (!loading && !user) return <p>Sign in to view this invoice.</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!invoice) return <p>Loading invoice…</p>;
  const manager = admin && ["admin", "manager"].includes(profile?.role ?? "");
  return <div className="space-y-5">
    <div className="no-print flex flex-wrap justify-end gap-3">
      {manager && <Button variant="secondary" onClick={() => setEditing((v) => !v)}>{editing ? "Close editor" : "Edit invoice"}</Button>}
      <Button onClick={() => window.print()}>Print / Save as PDF</Button>
    </div>
    {editing && manager && <InvoiceEditor invoice={invoice} onSaved={async () => { setEditing(false); await load(); }} />}
    <InvoiceView invoice={invoice} />
    {manager && invoice.history.length > 0 && <section className="no-print rounded-2xl bg-white p-5"><h2 className="font-semibold">Revision history</h2><ol className="mt-3 space-y-3">{[...invoice.history].reverse().map((h, n) => <li key={n} className="border-t pt-3 text-sm"><b>{h.byName}</b> · {new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}<p>{h.reason}</p><details className="mt-2"><summary className="cursor-pointer text-leaf-700">View changes</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ before: h.before, after: h.after }, null, 2)}</pre></details></li>)}</ol></section>}
  </div>;
}

function InvoiceEditor({ invoice: i, onSaved }: { invoice: InvoiceRecord; onSaved: () => Promise<void> }) {
  const [buyer, setBuyer] = useState({ name: i.buyer.name, phone: i.buyer.phone ?? "", email: i.buyer.email ?? "" });
  const [address, setAddress] = useState(i.buyer.address ?? { line1: "", city: "", state: "", pincode: "" });
  const [buyerGstin, setBuyerGstin] = useState(i.buyerGstin);
  const [note, setNote] = useState(i.note);
  const [reason, setReason] = useState("");
  const [rates, setRates] = useState(i.rows.map((r) => r.unitPrice));
  const [charges, setCharges] = useState({ discount: i.discount, packagingCharge: i.packagingCharge, deliveryCharge: i.deliveryCharge });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api(`/api/invoices/${i.kind}/${i.id}`, { revision: i.revision, reason, buyer: { ...buyer, address }, buyerGstin, note, ...(i.canEditAmounts ? { amounts: { rates, ...charges } } : {}) }, "PATCH");
      await onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="no-print space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
    <h2 className="font-semibold">Correct invoice {i.invoiceNo}</h2>
    <p className="text-sm text-stone-600">Invoice numbers and ordered quantities stay fixed. {i.canEditAmounts ? "Rates and charges can be corrected before payment." : "Amounts are locked because this invoice is paid, cancelled or linked to a payment request."}</p>
    <div className="grid gap-3 sm:grid-cols-2">{(["name", "phone", "email"] as const).map((key) => <Field key={key} label={`Buyer ${key}`}><Input required={key === "name"} type={key === "email" ? "email" : "text"} value={buyer[key]} onChange={(e) => setBuyer({ ...buyer, [key]: e.target.value })} /></Field>)}
      <Field label="Buyer GSTIN"><Input value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())} /></Field>
      {(["line1", "line2", "city", "state", "pincode"] as const).map((key) => <Field key={key} label={`Billing address: ${key}`}><Input value={address[key] ?? ""} onChange={(e) => setAddress({ ...address, [key]: e.target.value })} /></Field>)}
    </div>
    {i.canEditAmounts && <div className="grid gap-3 sm:grid-cols-2">{i.rows.map((r, n) => <Field key={n} label={`${r.name} · rate (${r.qty} ordered)`}><Input type="number" min={0} step="0.01" required value={rates[n]} onChange={(e) => setRates((values) => values.map((v, j) => j === n ? Number(e.target.value) : v))} /></Field>)}{(Object.keys(charges) as (keyof typeof charges)[]).map((key) => <Field key={key} label={key}><Input required type="number" min={0} step="0.01" value={charges[key]} onChange={(e) => setCharges({ ...charges, [key]: Number(e.target.value) })} /></Field>)}</div>}
    <Field label="Invoice note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    <Field label="Reason for correction (required)"><Input required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    <ErrorText>{error}</ErrorText><Button type="submit" loading={busy}>Save revision</Button>
  </form>;
}
