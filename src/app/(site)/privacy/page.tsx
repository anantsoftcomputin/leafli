import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Leafli collects, uses and protects your personal data when you order or subscribe, who we share it with, and how to delete it.", alternates: { canonical: "/privacy" } };

const BODY = `> Draft for review by your legal adviser before launch (Digital Personal Data Protection Act, 2023).

**{{legalName}}** respects your privacy. This policy explains what we collect and why.

## What we collect
- **Account details:** name, mobile number and/or email when you sign in with Google, OTP or email.
- **Delivery details:** addresses and the map location you share so riders can find you.
- **Orders & subscriptions:** what you ordered, preferences (e.g. vegetarian) and notes.
- **Payments:** processed by Razorpay. We never see or store your card or UPI credentials — only a payment reference.

## How we use it
To prepare and deliver your orders, run your subscription, send order updates, provide GST invoices, prevent fraud and improve our menu.

## Who we share it with
Only with service providers who help us deliver: Porter (delivery), Razorpay (payments), Google Firebase (hosting & sign-in) and, for orders placed there, Zomato. We do not sell your data.

## Your choices
You can view and update your details from your account, and ask us to delete your account and data by writing to {{email}}. We keep invoices for as long as tax law requires.

## Security
Data is stored on Google Cloud with access limited to staff who need it.

## Contact
Grievance officer: {{legalName}}, {{address}} · {{email}}
`;

export default function Privacy() {
  return <LegalPage title="Privacy Policy" path="/privacy" updated="23 October 2026" body={BODY} />;
}
