# Integrations

## leafli.in website

The existing site can keep its own design and use this system as the backend.

**Menu** — `GET https://<kitchen-domain>/api/public/menu` (no auth, cached 30 s):

```json
{ "acceptingOrders": true, "gstRate": 5, "packagingChargePerOrder": 0, "deliveryCharge": 0,
  "items": [{ "id": "chicken-caesar", "name": "Chicken Caesar Salad", "price": 349, "available": true,
              "diet": "nonveg", "allergens": ["egg","milk","mustard","gluten"], "category": "Salads",
              "description": "…", "imageUrl": null }] }
```

**Place an order** — sign the customer in with the same Firebase project (Google or phone OTP), then:

```http
POST /api/orders
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{ "source": "website",
  "customer": { "name": "Asha", "phone": "+919876543210",
                "address": { "line1": "12 MG Road", "city": "Pune", "state": "Maharashtra",
                             "pincode": "411001", "lat": 18.52, "lng": 73.85 } },
  "lines": [{ "menuItemId": "chicken-caesar", "qty": 1 }],
  "paymentMode": "pay_later",
  "deliveryProvider": "porter" }
```

Prices are always taken from the server; customers can't set discounts or prices. Add the site's origin to
`CORS_ALLOWED_ORIGINS`. The customer can follow the order at `/account/orders/<id>`.

## Porter

Uses Porter's API for businesses (credentials come from Porter's business team).

| Env | Purpose |
|---|---|
| `PORTER_BASE_URL` | `https://pfe-apigw-uat.porter.in` for testing, `https://pfe-apigw.porter.in` for production |
| `PORTER_API_KEY` | sent as `x-api-key` |
| `PORTER_WEBHOOK_SECRET` | random string; register the webhook as `…/api/integrations/porter/webhook?token=<secret>` |

Flow: order detail → **Get quote** → **Book Porter** → status updates arrive by webhook (or **Refresh status**).
`live` moves the order to *dispatched*, `ended` to *delivered*. The fare is stored on the order and
deducted in the food-cost contribution. Both the kitchen and customer addresses need lat/lng.

All request/response mapping is in [`src/lib/integrations/porter.ts`](../src/lib/integrations/porter.ts) — check
it against the exact spec version Porter gives you during onboarding.

## Zomato

Zomato does not have a self-serve public ordering API. There are two ways in:

1. **Become a Zomato POS integration partner** (apply through your Zomato account manager), or
2. **Use a relay** such as UrbanPiper or Petpooja, which forwards Zomato orders by webhook and accepts status callbacks.

Either way, point the inbound webhook at `POST /api/integrations/zomato/webhook` and set `ZOMATO_WEBHOOK_SECRET`.
Requests must carry either `x-signature: <hex HMAC-SHA256 of the raw body>` or `x-webhook-secret: <secret>`.

Until the partner payload is known, the webhook accepts this normalised shape (and tries common relay layouts):

```json
{ "externalId": "Z-987654",
  "customer": { "name": "Ravi", "phone": "+91…" },
  "lines": [{ "externalItemId": "ZOM-111", "name": "Chicken Caesar Salad", "qty": 1, "unitPrice": 379 }],
  "discount": 0, "notes": "no onion", "deliveryByAggregator": true }
```

- Items match a menu item by `menuItemId`, then by the **Zomato item ID** set on the dish, then by name.
  Unmatched items are rejected with 422 and logged under Settings → Integrations.
- Orders are idempotent on `externalId` — retries never duplicate.
- GST is not charged (Zomato pays it under s.9(5)); commission is estimated from Settings for margin reports.
- `ZOMATO_AUTO_ACCEPT=true` accepts (and deducts stock) on arrival; otherwise the kitchen accepts on the board.
- Status changes are pushed to `ZOMATO_STATUS_CALLBACK_URL`; dish availability toggles to `ZOMATO_ITEM_STOCK_URL`.

When you have the partner spec, edit `normalizeZomatoOrder`, `OUTBOUND` and `pushZomatoItemStock` in
[`src/lib/integrations/zomato.ts`](../src/lib/integrations/zomato.ts) — nothing else needs to change.

**Today, without an integration:** Billing → *Zomato (manual)* lets the cashier punch in a Zomato order with its
Zomato order ID and the price charged, so stock and food cost stay accurate from day one.

## Razorpay

Server code: [`src/lib/integrations/razorpay.ts`](../src/lib/integrations/razorpay.ts) (API calls) and
[`src/lib/server/payments.ts`](../src/lib/server/payments.ts) (what a payment means for an order or plan).

**Setup**

1. Dashboard → Account & Settings → API keys → `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (`rzp_live_…` in production).
2. Dashboard → Account & Settings → Webhooks → *Add new webhook*:
   - URL `https://<domain>/api/payments/razorpay/webhook`
   - Secret = `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`,
     `refund.processed`, `refund.failed`, `payment_link.paid`
3. Set the same three variables on the host (Netlify → Site configuration → Environment variables), then redeploy.
4. Admin → Settings → Integrations should show **live · verified** and the webhook as configured.

**How money flows**

| Situation | What happens |
| --- | --- |
| Website order, pay online | We create a Razorpay order for the server-computed total; Checkout opens; the signed result is verified and the payment fetched from Razorpay (captured if only authorized). Only then does the order reach the kitchen. |
| Customer closes the tab / webhook missed | The order page asks Razorpay on open (`/api/payments/razorpay/reconcile`); staff have *Check with Razorpay*. |
| Payment attempt fails | `payment.failed` stores the reason; the customer sees it next to *Pay*. |
| Razorpay order can't be created | The order (or plan) is cancelled immediately and the customer is asked to retry. |
| Order cancelled after payment | Refunded automatically (whatever hasn't been refunded yet). |
| Paid twice, or paid after cancelling | The extra payment is refunded automatically and logged. |
| Complaint / missing item | Order → Payment → *Refund…* (managers): full or partial, with a reason. Refund status follows `refund.processed` / `refund.failed`. |
| Pay-later or phone order | Order → Payment → *Send payment link*: Razorpay texts the customer a link (valid 7 days); paying it marks the order paid. Cancelling the order cancels the link. |
| Subscription plans | Same Checkout + verify + reconcile; refunds from Subscriptions → *All plans* → payment. A full refund cancels the plan. |

Webhook events are de-duplicated by `x-razorpay-event-id`. Events we can't match are logged and acknowledged
with 200, so Razorpay never disables the webhook over them.

## Email (support@leafli.in)

Sent over SMTP through GoDaddy (`smtpout.secureserver.net`, port 465, SSL) as **support@leafli.in**. leafli.in's
DNS has SPF `-all` and DMARC `p=reject`, so mail **must** go through GoDaddy — any other sender is rejected.

Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `STAFF_ALERT_EMAILS` (set the same on Netlify).

Code: [`src/lib/server/email/`](../src/lib/server/email/) — `send.ts` (SMTP, log, de-dupe), `layout.ts` (brand blocks),
`templates.ts` (every email), `notify.ts` (which email goes when). Admin → **Emails** previews every template,
sends a test and lists recent sends. `npm run emails:render <dir>` writes them all to HTML files.

| When | Who gets it |
| --- | --- |
| First sign-in with an email | Customer — welcome |
| Order goes live (pay-later placed / online paid) | Customer — receipt; team — new-order alert |
| Ready (pickup) / out for delivery / delivered / cancelled | Customer |
| Staff send a payment link | Customer |
| Manager refund started / refund processed | Customer |
| Auto-refund or Razorpay refund fails | Team |
| Plan reserved (offline) / active (paid) | Customer (with invoice); team alert |
| Plan paused / resumed / cancelled / 2 bowls left / finished / expired | Customer |

Zomato orders and daily subscription meals don't email the customer. Emails never block an order or payment:
failures are logged in `emailLog` and shown on the Emails page. Phone-OTP customers can add an email at checkout
(saved as `contactEmail` on their profile).

## WhatsApp (official Cloud API by Meta)

No middleman: messages go straight to `graph.facebook.com`. You pay Meta per delivered message (order/plan updates are
the cheap **utility** category, and free inside a 24-hour window after the customer messages you).

Code: [`src/lib/integrations/whatsapp.ts`](../src/lib/integrations/whatsapp.ts) (API),
[`src/lib/server/whatsapp/templates.ts`](../src/lib/server/whatsapp/templates.ts) (all 15 messages),
[`src/lib/server/whatsapp/notify.ts`](../src/lib/server/whatsapp/notify.ts) (when they go out). Email and WhatsApp fire
from the same events via [`src/lib/server/notifications.ts`](../src/lib/server/notifications.ts).

**One-time setup**

1. **Meta Business** — business.facebook.com → Settings → Business info → *Start verification* (GST certificate etc.).
2. **App** — developers.facebook.com → My apps → Create app → *Business* → add **WhatsApp**. Under WhatsApp → API Setup,
   add your business phone number (not logged into the WhatsApp app) and verify it by SMS/call. Copy the
   **Phone number ID** and **WhatsApp Business Account ID**.
3. **Permanent token** — Business settings → Users → System users → Add (admin) → Assign assets: the app and the WhatsApp
   account (full control) → *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management`.
4. **Payment method** — WhatsApp Manager → Account tools → Payment methods (needed to message beyond the free tier).
5. **Env on Netlify** — `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_APP_SECRET` (App settings → Basic), `WHATSAPP_VERIFY_TOKEN`, `STAFF_WHATSAPP_NUMBERS`. Redeploy.
6. **Webhook** — app → WhatsApp → Configuration → Callback URL `https://<domain>/api/integrations/whatsapp/webhook`,
   Verify token = `WHATSAPP_VERIFY_TOKEN` → Verify and save → subscribe to **messages**.
7. **Templates** — Admin → WhatsApp → *Submit to Meta*. Review takes minutes to a day; status shows on the same page.
   Then send yourself a test.

**Who gets what**

| Event | Message |
| --- | --- |
| Order live (pay-later placed / online paid) | Customer: confirmed + track button · Team: new order |
| Ready (pickup) / out for delivery / delivered / cancelled | Customer |
| Staff send a payment link | Customer (Pay now button → Razorpay) |
| Refund started / processed | Customer |
| Refund fails | Team |
| Plan reserved / active / paused / resumed / cancelled / 2 left / finished / expired | Customer |

Customers are messaged only if they ticked **"updates on WhatsApp"** at checkout or plan sign-up (Meta requires opt-in).
Replying **STOP** opts a number out, **START** opts back in. Customer replies appear in Admin → WhatsApp, where staff can
answer from the business number within 24 hours of the customer's last message.
