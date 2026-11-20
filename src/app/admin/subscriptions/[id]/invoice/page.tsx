"use client";

import Link from "next/link";
import { use } from "react";
import { InvoicePage } from "@/components/InvoicePage";

export default function AdminSubscriptionInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div>
      <Link href="/admin/subscriptions" className="no-print text-sm text-stone-500 hover:underline">← Subscriptions</Link>
      <div className="mt-4">
        <InvoicePage kind="subscription" id={id} admin />
      </div>
    </div>
  );
}
