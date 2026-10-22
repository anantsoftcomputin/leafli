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
