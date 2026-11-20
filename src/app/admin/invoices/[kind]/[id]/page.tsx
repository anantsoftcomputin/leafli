"use client";
import Link from "next/link";
import { use } from "react";
import { InvoicePage } from "@/components/InvoicePage";
export default function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = use(params);
  if (kind !== "order" && kind !== "subscription") return <p>Invoice not found.</p>;
  return <div><Link className="no-print mb-4 inline-block text-sm text-leaf-700 underline" href="/admin/invoices">All invoices</Link><InvoicePage kind={kind} id={id} admin /></div>;
}
