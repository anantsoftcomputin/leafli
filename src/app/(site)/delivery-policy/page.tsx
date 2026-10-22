import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Delivery Policy", description: "Leafli delivery areas, timings and charges: how on-demand orders and subscription lunches and dinners reach you, chilled and on time.", alternates: { canonical: "/delivery-policy" } };

const BODY = `> Draft for review before launch.

## How we deliver
Orders are delivered from our cloud kitchen by Porter delivery partners, in rigid sealed bowls with dressings packed separately and kept chilled.

## Timings
- **On-demand orders:** most orders are prepared in 15–20 minutes, then handed to a rider. You'll get a live tracking link once the rider is assigned.
- **Subscriptions:** lunch deliveries arrive between 12 pm and 2 pm, dinner between 7 pm and 9 pm, on the days you choose.

## Delivery area
We deliver to addresses our riders can reach from our kitchen. Share your location at checkout so the rider can find you.

## Delivery charges
Any delivery charge is shown before you pay. Subscription plans include delivery.

## If you're not available
Riders will call you on arrival. If we can't reach you after reasonable attempts, the order is treated as delivered.

## Contact
{{email}} · {{phone}}
`;

export default function DeliveryPolicy() {
  return <LegalPage title="Delivery Policy" path="/delivery-policy" updated="23 October 2026" body={BODY} />;
}
