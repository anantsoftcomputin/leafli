import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Refund & Cancellation Policy", description: "How cancellations and refunds work for Leafli orders and salad subscriptions, including timelines for online refunds through Razorpay.", alternates: { canonical: "/refunds" } };

const BODY = `> Draft for review before launch.

## Orders
- **Before the kitchen starts preparing:** cancel from your order page or contact us for a full refund.
- **After preparation has started:** fresh food can't be resold, so we can't offer a refund — unless something went wrong on our side.
- **Something wrong with your order?** Missing items, a wrong bowl or a quality issue — tell us within 2 hours of delivery with a photo and we'll replace it or refund it.

## Subscriptions
- **Before your first delivery:** cancel for a full refund.
- **After deliveries have started:** we refund the unused bowls at the plan's per-bowl price, less any discount you received compared with ordering individually.
- Bowls that expire at the end of the validity period are not refundable.

## How refunds are paid
Online payments are refunded to the original payment method through Razorpay, usually within **5–7 working days**. Cash payments are refunded by UPI.

## Contact
{{email}} · {{phone}}
`;

export default function Refunds() {
  return <LegalPage title="Refund & Cancellation Policy" path="/refunds" updated="23 October 2026" body={BODY} />;
}
