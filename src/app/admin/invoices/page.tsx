"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/costing";
import { Button, Card, ErrorText, Input, PageHeader, Select } from "@/components/ui";
import type { InvoiceKind } from "@/lib/invoice-record";

type Row = { id: string; kind: InvoiceKind; invoiceNo: string; issuedAt: number; name: string; phone: string; reference: string; total: number; paymentStatus: string; status: string };
type Page = { kind: InvoiceKind; cursor: string | null; hasMore: boolean };
type Result = { rows: Row[]; pages: Page[] };
export default function Invoices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load(reset = false, exact = "") {
    setBusy(true); setError(null);
    const query = new URLSearchParams();
    if (exact) query.set("invoiceNo", exact);
    if (!reset) for (const page of pages) {
      if (page.cursor) query.set(`${page.kind}Cursor`, page.cursor);
      if (!page.hasMore) query.set(`${page.kind}Done`, "1");
    }
    try { const r = await api<Result>(`/api/invoices?${query}`); setRows((prev) => reset ? r.rows : [...prev, ...r.rows]); setPages(r.pages); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  // Initial register; later loads use the current pagination cursors.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true); }, []);
  const visible = rows.filter((r) => (kind === "all" || r.kind === kind) && (status === "all" || r.paymentStatus === status) && `${r.invoiceNo} ${r.reference} ${r.name} ${r.phone}`.toLowerCase().includes(search.toLowerCase()));
  function exportCsv() {
    const csv = [["Invoice", "Date (IST)", "Type", "Buyer", "Reference", "Total", "Payment", "Order status"], ...visible.map((r) => [r.invoiceNo, new Date(r.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), r.kind, r.name, r.reference, String(r.total), r.paymentStatus, r.status])].map((row) => row.map((s) => `"${String(s).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "leafli-invoices.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-4">
    <PageHeader title="Invoices" sub="Order and subscription tax invoices, including previous financial years." actions={<><Button variant="secondary" onClick={exportCsv} disabled={!visible.length}>Export CSV</Button><Button variant="secondary" loading={busy} onClick={() => { setSearch(""); void load(true); }}>Refresh</Button></>} />
    <div className="flex flex-wrap gap-3"><Input className="min-w-64 flex-1" placeholder="Search loaded invoices, buyer, phone or order…" value={search} onChange={(e) => setSearch(e.target.value)} /><Select className="w-44" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All invoice types</option><option value="order">Orders</option><option value="subscription">Subscriptions</option></Select><Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All payments</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="refunded">Refunded</option></Select></div>
    {search.startsWith("LF/") && <Button variant="secondary" onClick={() => load(true, search)}>Find this invoice across all years</Button>}
    <ErrorText>{error}</ErrorText>
    <Card flush><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50"><tr>{["Invoice", "Issued (IST)", "Buyer", "Type / reference", "Total", "Status", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{visible.map((r) => <tr key={`${r.kind}-${r.id}`} className="border-t border-stone-100"><td className="p-3 font-semibold"><Link className="text-leaf-700 underline" href={`/admin/invoices/${r.kind}/${r.id}`}>{r.invoiceNo}</Link></td><td className="p-3 whitespace-nowrap">{new Date(r.issuedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td className="p-3">{r.name}<p className="text-stone-500">{r.phone}</p></td><td className="p-3">{r.kind}<p className="text-stone-500">{r.reference}</p></td><td className="p-3 whitespace-nowrap">{inr(r.total)}</td><td className="p-3">{r.paymentStatus}<p className="text-stone-500">{r.status}</p></td><td className="p-3"><Link className="text-leaf-700 underline" href={`/admin/invoices/${r.kind}/${r.id}`}>View / edit / print</Link></td></tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-stone-500">{busy ? "Loading invoices…" : "No matching invoices in the loaded records."}</p>}</div></Card>
    <div className="flex items-center justify-between gap-3 text-sm text-stone-500"><p>{visible.length} shown · {rows.length} loaded</p>{pages.some((p) => p.hasMore) && <Button variant="secondary" loading={busy} onClick={() => load()}>Load older invoices</Button>}</div>
  </div>;
}
