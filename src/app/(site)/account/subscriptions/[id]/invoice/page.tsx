"use client";

import Link from "next/link";
import { use } from "react";
import { SubscriptionInvoicePage } from "@/components/SubscriptionInvoiceView";

export default function SubscriptionInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-3xl px-5">
      <Link href={`/account/subscriptions/${id}`} className="no-print text-sm text-ink/50 hover:underline">← Back to my plan</Link>
      <div className="mt-4">
        <SubscriptionInvoicePage id={id} />
      </div>
    </div>
  );
}
