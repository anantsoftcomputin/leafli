"use client";
import { use } from "react";
import Link from "next/link";
import { InvoicePage } from "@/components/InvoicePage";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <div className="mx-auto max-w-4xl px-5 pt-28 pb-16"><Link className="no-print mb-4 inline-block text-leaf-700 underline" href={`/account/orders/${id}`}>Back to order</Link><InvoicePage kind="order" id={id} /></div>;
}
