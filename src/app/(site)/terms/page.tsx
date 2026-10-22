import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms that apply when you order food from Leafli or buy a salad subscription, including allergens, subscriptions and liability.", alternates: { canonical: "/terms" } };

const BODY = `> Draft for review by your legal adviser before launch.

These terms apply to orders and subscriptions placed on leafli.in, operated by **{{legalName}}** ("Leafli", "we"). By placing an order you agree to them.

## Orders
- Prices are shown in Indian Rupees. Applicable GST is added at checkout and shown on your invoice.
- An order is confirmed when we accept it. We may decline or cancel an order if an item is unavailable, your address is outside our delivery area, or payment fails — any amount paid is refunded in full.
- Photos are representative; garnishes and seasonal fruit may vary.

## Subscriptions
- A subscription is a prepaid pack of bowls that must be used within the validity period shown on the plan.
- You can skip a day, pause the plan or change your bowl until 9 pm the day before a delivery. Pausing extends validity by the paused days (up to 30 days).
- Unused bowls expire at the end of the validity period. See our [Refund policy](/refunds) for cancellations.

## Allergens & dietary information
Allergen information is listed on every dish. Our kitchen handles nuts, peanuts, sesame, soy, gluten, egg, dairy and mustard, so we cannot guarantee any dish is free from traces of allergens. Please tell us about allergies before ordering.

## Accounts
You're responsible for keeping your account secure and your contact and address details accurate.

## Liability
To the extent permitted by law, our liability for any order is limited to the amount you paid for it.

## Contact
{{legalName}}, {{address}} · {{email}} · {{phone}}

These terms are governed by the laws of India.
`;

export default function Terms() {
  return <LegalPage title="Terms of Service" path="/terms" updated="23 October 2026" body={BODY} />;
}
