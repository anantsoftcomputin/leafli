# Leafli Kitchen

Billing, orders, inventory, batch prep, purchasing and food-cost management for the Leafli cloud kitchen.
Next.js 15 (App Router) + Tailwind CSS on the front, Firebase (Auth, Firestore, Storage) on the back,
deployed on Firebase App Hosting.

## What's in it

| Area | What it does |
|---|---|
| **Billing / POS** (`/pos`) | Counter, phone and manual Zomato orders. Server-priced, 5% GST split CGST/SGST, sequential FY invoice numbers (`LF/26-27/00001`), printable tax invoice. |
| **Orders** (`/orders`) | Live board across counter, website and Zomato. Accept → preparing → ready → dispatched → delivered, with Porter booking/tracking per order. |
| **Kitchen display** (`/kitchen`) | Tickets oldest-first with each dish's SOP assembly steps and allergens; prep-needed and expiring-batch alerts. |
| **Batch prep** (`/production`) | Make dressings, sauces and cooked components per SOP. Records actual weighed yield, sets use-by from the shelf-life guide, consumes stock FIFO, write-off of expired batches. |
| **Inventory** (`/inventory`) | Raw + prep stock, wastage with reasons, physical stock counts (variance logged), full movement ledger per item. |
| **Purchasing** (`/purchasing`) | Reorder suggestions from reorder levels → draft POs grouped by supplier → send on WhatsApp → receive with actual prices (weighted-average costing). |
| **Menu & recipes** (`/menu`) | Dishes with per-portion BOM (incl. packaging), sub-recipes, live food cost %, per-channel prices, Zomato item mapping, availability toggle. |
| **Food cost** (`/food-cost`) | Theoretical vs actual food cost (adds wastage and count variance), contribution after Zomato commission and Porter fares, menu engineering (Star / Plowhorse / Puzzle / Dog). |
| **Shop** (`/shop`, `/account`) | Customer ordering with Google or phone-OTP sign-in, location capture for delivery, live order tracking. |
| **APIs for leafli.in** | `GET /api/public/menu`, `POST /api/orders` (CORS-restricted). |
| **Integrations** | Porter (quote, book, track, cancel, webhook) and Zomato (inbound webhook, status + stock callbacks). See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md). |

All SOPs (LF-KIT-SOP-001, 003–007) and the Practical Shelf-Life Guide are encoded in
[`src/lib/seed/sopData.ts`](src/lib/seed/sopData.ts): 64 raw materials (incl. packaging), 13 batch preps, 6 dishes.
Every quantity the SOPs leave "to be confirmed" is flagged **TBC** and listed on the dashboard.

## Setup

1. **Firebase project** — in the console create a project, then:
   - Authentication → enable **Google** and **Phone** providers; add your domains (e.g. `kitchen.leafli.in`, `localhost`) to *Authorized domains*.
   - Firestore → create database (production mode, region `asia-south1`).
   - Storage → enable.
   - Register a **Web app** and copy its config.
2. **Local env** — `cp .env.example .env.local`, fill the `NEXT_PUBLIC_FIREBASE_*` values, and paste a service-account key (Project settings → Service accounts) as one line into `FIREBASE_SERVICE_ACCOUNT_JSON`. Put your email in `ADMIN_EMAILS`.
3. **Deploy rules & indexes** — `firebase use <project-id>` then `firebase deploy --only firestore,storage`.
4. **Run** — `npm install && npm run dev`, open http://localhost:3000/login and sign in with the admin email.
5. **Load the SOP data** — `npm run seed` (or Settings → *Load SOP data*). This writes the menu, recipes, stock items and
   suppliers to Firestore and uploads the dish photos from `seed-assets/menu/` to Firebase Storage (`menu/…`). Then:
   - Settings → fill legal name, **GSTIN**, **FSSAI**, kitchen address **with coordinates** (needed for Porter).
   - Suppliers → rename the placeholder vendors and add WhatsApp numbers.
   - Menu → set real selling prices; confirm the TBC quantities.
   - Purchasing → *Create draft POs* → receive your opening stock (this replaces placeholder costs with real ones).
6. **Team** — staff sign in once, then Settings → Team assigns `manager`, `cashier` or `kitchen`.

## Deploy (Firebase App Hosting)

```bash
firebase apphosting:backends:create --project <project-id>   # connect the GitHub repo
firebase apphosting:secrets:set porter-api-key
firebase apphosting:secrets:set porter-webhook-secret
firebase apphosting:secrets:set zomato-webhook-secret
```

Fill the `REPLACE_ME` values in [`apphosting.yaml`](apphosting.yaml) and push. App Hosting's service account
already has Firestore access, so `FIREBASE_SERVICE_ACCOUNT_JSON` is not needed in production.

## How stock flows

```
Purchase order received ─▶ raw stock ↑ (weighted-average cost)
Batch prep recorded     ─▶ raw stock ↓, prep stock ↑, dated batch with use-by
Order accepted          ─▶ dish recipe exploded; raw ↓, prep ↓ (oldest batch first)
Cancelled before prep   ─▶ everything restored to the exact batches it came from
Wastage / expiry / count─▶ stock ↓/↑ with reason, valued at cost
```

POS bills deduct immediately; website and Zomato orders deduct when the kitchen accepts them.
Every change writes a `stockMovements` ledger row inside the same Firestore transaction, so stock always
reconciles with the ledger. Clients can't write stock, orders or POs — only the server can (see `firestore.rules`).

## Checks

```bash
npm run typecheck
npm run check      # SOP data integrity + costing/GST maths
npm run test:e2e   # full order/stock/PO/batch flow on the Firestore emulator (needs Java)
```

## Things to confirm before go-live

- **Placeholder prices & costs** — selling prices and ingredient costs are indicative, flagged "est.".
- **SOP open items** — chocolate powder qty, fruit bowl portions, walnut/cherry tomato/Ghibriche portions,
  croutons/potato oil & salt, chicken marinade quantities, and yields for noodles, chana, moong and the mango dressing.
- **GST** — 5% without ITC assumes a standalone cloud kitchen; confirm with your CA. Zomato orders are recorded without
  GST because Zomato pays it under section 9(5).
- **Payments** — website orders are pay-on-delivery for now; an online gateway (e.g. Razorpay) is the next addition.

## Payments (Razorpay)

1. Razorpay Dashboard → Account & Settings → API keys → put `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `.env`
   (use `rzp_test_…` keys first; swap to live keys at launch).
2. Dashboard → Webhooks → add `https://<your-domain>/api/payments/razorpay/webhook`, events **payment.captured** and
   **order.paid**, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Customers choose *Pay online* or *Pay on delivery* at checkout. Online orders stay hidden from the kitchen until
   Razorpay confirms payment; cancelling a paid order refunds it automatically.

## Replacing the old leafli.in

1. Deploy this app on Firebase App Hosting (see *Deploy* above) and test it on the `*.hosted.app` URL.
2. Firebase console → App Hosting → your backend → **Custom domains** → add `leafli.in` and `www.leafli.in`, then
   update the DNS records at your registrar as shown there.
3. Add `leafli.in` to Firebase Authentication → Settings → **Authorized domains** (needed for Google & phone sign-in).
4. Move the Razorpay webhook to the new domain and retire the old `api.leafli.in` backend once traffic has moved.
