// Shared domain types for the Leafli kitchen system.
// All quantities are stored in an item's base unit (g, ml or pc).
// All money is stored in rupees as plain numbers (2-decimal rounding at the edges).

export type Role = "admin" | "manager" | "kitchen" | "cashier" | "customer";
export const STAFF_ROLES: Role[] = ["admin", "manager", "kitchen", "cashier"];

export type BaseUnit = "g" | "ml" | "pc";

export interface Address {
  label?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email?: string | null;
  /** Email a phone-OTP customer gave at checkout, for receipts. */
  contactEmail?: string | null;
  phone?: string | null;
  role: Role;
  addresses?: Address[];
  createdAt: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  leadTimeDays: number;
  notes?: string;
}

/** One line of a bill of materials. Refers to any stock item (raw or prep). */
export interface RecipeLine {
  itemId: string;
  qty: number; // in the referenced item's base unit
  /** True when the SOP leaves this quantity "to be confirmed". */
  tbc?: boolean;
  note?: string;
}

/**
 * A stock item. `raw` items are purchased; `prep` items are produced in batches
 * from a recipe (dressings, sauces, cooked components) and carry a use-by.
 */
export interface StockItem {
  id: string;
  name: string;
  kind: "raw" | "prep";
  category: string;
  unit: BaseUnit;
  currentStock: number;
  reorderLevel: number;
  reorderQty: number; // in base units
  /** Purchase unit, e.g. "kg" with factor 1000 when base unit is g. */
  purchaseUnit?: string;
  purchaseFactor?: number;
  /** Cost per base unit. For prep items this is derived from the recipe. */
  costPerUnit: number;
  costIsEstimate?: boolean;
  supplierId?: string | null;
  allergens?: string[];
  /** Practical refrigerated shelf-life target, hours (Leafli shelf-life guide). */
  shelfLifeHours?: number | null;
  storage?: "chilled" | "ambient" | "frozen";
  // prep-only
  recipe?: RecipeLine[];
  yieldQty?: number; // base units produced by one batch of `recipe`
  yieldIsEstimate?: boolean;
  method?: string[];
  qualityStandard?: string;
  sopRef?: string;
  active: boolean;
  updatedAt?: number;
}

export interface PrepBatch {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  remaining: number;
  batches: number; // multiples of the base recipe
  unitCost: number;
  preparedAt: number;
  useBy: number | null;
  preparedBy: string;
  preparedByName?: string;
  status: "active" | "consumed" | "expired" | "discarded";
}

export type MovementType =
  | "purchase"
  | "sale"
  | "sale_reversal"
  | "production_in"
  | "production_out"
  | "wastage"
  | "adjustment";

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: MovementType;
  qty: number; // signed, base units
  unitCost: number;
  value: number; // signed qty * unitCost
  refType?: "order" | "po" | "batch" | "manual";
  refId?: string;
  note?: string;
  by: string;
  at: number;
}

export type Channel = "pos" | "website" | "zomato";

export interface MenuItem {
  id: string;
  /** URL slug for /menu/[slug] (kept identical to the old leafli.in /products/[slug]). */
  slug?: string;
  /** Customer-facing ingredient list (shown on the dish page). */
  ingredients?: string[];
  name: string;
  description: string;
  category: string;
  price: number; // selling price excluding GST
  imageUrl?: string | null; // round cut-out (Firebase Storage)
  photoUrl?: string | null; // square photo (Firebase Storage)
  ogImageUrl?: string | null; // 1200×630 JPEG share card
  available: boolean;
  channels: Record<Channel, boolean>;
  /** Optional per-channel price override (e.g. Zomato menu markup). */
  channelPrice?: Partial<Record<Channel, number>>;
  recipe: RecipeLine[];
  packagingCost: number;
  allergens: string[];
  assembly?: string[];
  qualityStandard?: string;
  sopRef?: string;
  zomatoItemId?: string;
  diet: "veg" | "egg" | "nonveg";
  nutrition?: { calories?: number; protein?: number };
  sortOrder: number;
  openItems?: string[]; // SOP items still to be confirmed
}

export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "dispatched"
  | "delivered"
  | "cancelled";

export interface OrderLine {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  unitCost: number; // food + packaging cost snapshot at time of order
  notes?: string;
}

export interface DeliveryInfo {
  provider: "porter" | "zomato" | "self" | "pickup";
  porterOrderId?: string;
  porterRequestId?: string;
  trackingUrl?: string;
  status?: string;
  fare?: number;
  vehicle?: string;
  partnerName?: string;
  partnerPhone?: string;
  eta?: number | null;
  updatedAt?: number;
}

export interface Order {
  id: string;
  orderNo: string;
  invoiceNo?: string;
  source: Channel;
  externalId?: string | null;
  customerUid?: string | null;
  customer: { name: string; phone?: string; email?: string; address?: Address | null };
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  packagingCharge: number;
  deliveryCharge: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  /** For aggregator orders GST is paid by the e-commerce operator (CGST s.9(5)). */
  gstCollectedByAggregator: boolean;
  aggregatorCommission: number;
  foodCost: number;
  paymentMode: "cash" | "upi" | "card" | "online" | "zomato" | "pay_later";
  paymentStatus: "pending" | "paid" | "refunded";
  /** Set when the order is a prepaid meal from a subscription. */
  subscriptionId?: string | null;
  /** Online payment details (Razorpay). */
  payment?: RazorpayPayment;
  /** Channels the customer opted into for updates. */
  notify?: { whatsapp?: boolean };
  /** Razorpay payment link sent by staff for a pay-later / phone order. */
  paymentLink?: { id: string; url: string; createdAt: number; by: string };
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: number; by: string }[];
  stockDeducted: boolean;
  delivery: DeliveryInfo;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseOrderLine {
  itemId: string;
  itemName: string;
  qty: number; // base units
  unitCost: number; // per base unit
  receivedQty?: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string;
  supplierName: string;
  lines: PurchaseOrderLine[];
  status: "draft" | "sent" | "received" | "cancelled";
  total: number;
  expectedAt?: number | null;
  receivedAt?: number | null;
  createdAt: number;
  createdBy: string;
  notes?: string;
}

export interface BusinessSettings {
  name: string;
  legalName: string;
  gstin: string;
  fssai: string;
  phone: string;
  email: string;
  address: Address;
  gstRate: number; // 5 for restaurant service without ITC
  packagingChargePerOrder: number;
  defaultDeliveryCharge: number;
  zomatoCommissionPct: number;
  acceptingOrders: boolean;
  /** Website ordering hours, India time ("HH:MM"). Missing → DEFAULT_HOURS. */
  orderingHours?: { opens: string; closes: string };
  porterEnabled: boolean;
  zomatoEnabled: boolean;
  invoiceFooter: string;
  /** Public review pages linked from the testimonials section. */
  googleReviewUrl?: string;
  zomatoUrl?: string;
}

export const ORDER_FLOW: OrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "dispatched",
  "delivered",
];

export interface RazorpayPayment {
  provider: "razorpay";
  rzpOrderId: string;
  paymentId?: string;
  paidAt?: number;
  /** upi / card / netbanking / wallet … as reported by Razorpay. */
  method?: string;
  /** Last failed attempt, so the customer and staff can see why. */
  lastError?: string;
  lastErrorAt?: number;
  /** Most recent refund; refundedAmount is the running total in rupees. */
  refundId?: string;
  refundStatus?: "pending" | "processed" | "failed";
  refundedAmount?: number;
  refundError?: string;
}

/** Online orders stay out of the kitchen until Razorpay confirms payment. */
export const awaitingPayment = (o: Pick<Order, "paymentMode" | "paymentStatus" | "status">) =>
  o.paymentMode === "online" && o.paymentStatus === "pending" && o.status !== "cancelled";

// ───────────────────────────────────────────── Subscriptions

export type DietPref = "veg" | "egg" | "nonveg";

export interface Plan {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string; // markdown
  meals: number; // prepaid bowls
  validityDays: number; // days to use them from the start date
  price: number; // excl. GST
  compareAtPrice: number; // price of the same bowls bought one by one
  /** Dishes the rotation may use; empty = every salad on the menu. */
  eligibleMenuIds: string[];
  freeDelivery: boolean;
  features: string[];
  highlight?: string | null; // e.g. "Most popular"
  active: boolean;
  sortOrder: number;
  faqs?: { q: string; a: string }[];
  metaTitle?: string;
  metaDescription?: string;
  updatedAt?: number;
}

export type SubscriptionStatus = "pending_payment" | "active" | "paused" | "completed" | "cancelled" | "expired";

export interface Subscription {
  id: string;
  planId: string;
  planName: string;
  customerUid: string;
  customer: { name: string; phone?: string; email?: string | null };
  address: Address;
  slot: "lunch" | "dinner";
  /** 0 = Sunday … 6 = Saturday */
  deliveryDays: number[];
  diet: DietPref;
  startDate: string; // YYYY-MM-DD (IST)
  endDate: string; // last usable day (start + validity)
  mealsTotal: number;
  mealsUsed: number;
  /** Customer picks for specific dates; otherwise the chef's rotation decides. */
  selections: Record<string, string>;
  skipped: string[]; // YYYY-MM-DD
  /** Dates an order has already been generated for. */
  fulfilled: Record<string, string>; // date -> orderId
  status: SubscriptionStatus;
  pausedFrom?: string | null;
  price: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  total: number;
  paymentMode: "online" | "offline";
  paymentStatus: "pending" | "paid" | "refunded";
  payment?: RazorpayPayment;
  notify?: { whatsapp?: boolean };
  invoiceNo?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ───────────────────────────────────────────── Content

export interface PostFaq {
  q: string;
  a: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // markdown
  coverImage?: string | null;
  coverAlt?: string;
  authorName: string;
  authorBio?: string;
  category: string;
  tags: string[];
  status: "draft" | "published" | "scheduled";
  publishedAt?: number | null;
  updatedAt: number;
  createdAt: number;
  readingMinutes?: number;
  wordCount?: number;
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  canonicalUrl?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string | null;
  twitterCard?: "summary" | "summary_large_image";
  schemaType?: "BlogPosting" | "Article" | "NewsArticle";
  faqs?: PostFaq[];
  relatedMenuIds?: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  quote: string;
  rating: number; // 1-5
  dish?: string;
  location?: string;
  source?: "google" | "zomato" | "instagram" | "direct";
  published: boolean;
  /** Submitted by a customer on the site and waiting for approval. */
  pending?: boolean;
  uid?: string | null;
  orderId?: string | null;
  sortOrder: number;
  createdAt: number;
}
