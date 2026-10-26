// Bill computation. The server is the source of truth; the POS uses the same
// function for the live preview so the numbers always match.
import { round2 } from "./costing";
import type { BusinessSettings, Channel } from "./types";
import { DEFAULT_HOURS } from "./hours";

export interface BillInput {
  source: Channel;
  lines: { unitPrice: number; qty: number }[];
  discount?: number; // flat rupees, applied before tax
  delivery?: boolean;
  deliveryCharge?: number;
  /** Prepaid subscription meal: GST was invoiced with the subscription, so none here. */
  prepaid?: boolean;
}

export interface Bill {
  subtotal: number;
  discount: number;
  packagingCharge: number;
  deliveryCharge: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  gstCollectedByAggregator: boolean;
  aggregatorCommission: number;
}

/**
 * GST notes (India): a standalone restaurant / cloud kitchen supplies at 5% GST
 * (2.5% CGST + 2.5% SGST, intra-state, no ITC). For orders through Zomato, the
 * e-commerce operator collects and pays the GST under section 9(5) of the CGST
 * Act, so we record the order net of GST and do not charge tax on our side.
 */
export function computeBill(input: BillInput, s: BusinessSettings): Bill {
  const subtotal = round2(input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0));
  const discount = round2(Math.min(Math.max(input.discount ?? 0, 0), subtotal));
  const isAggregator = input.source === "zomato";
  const noExtras = isAggregator || !!input.prepaid;
  const packagingCharge = noExtras || subtotal === 0 ? 0 : s.packagingChargePerOrder;
  const deliveryCharge = noExtras || !input.delivery ? 0 : round2(input.deliveryCharge ?? s.defaultDeliveryCharge);
  const taxableValue = round2(subtotal - discount + packagingCharge + deliveryCharge);
  const half = noExtras ? 0 : round2((taxableValue * s.gstRate) / 200);
  const gross = taxableValue + half * 2;
  const total = Math.round(gross);
  return {
    subtotal,
    discount,
    packagingCharge,
    deliveryCharge,
    taxableValue,
    cgst: half,
    sgst: half,
    roundOff: round2(total - gross),
    total,
    gstCollectedByAggregator: isAggregator,
    aggregatorCommission: isAggregator ? round2(((subtotal - discount) * s.zomatoCommissionPct) / 100) : 0,
  };
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  name: "Leafli",
  legalName: "Leafli",
  gstin: "",
  fssai: "",
  phone: "",
  email: "",
  address: { line1: "", city: "", state: "", pincode: "" },
  gstRate: 5,
  packagingChargePerOrder: 0,
  defaultDeliveryCharge: 0,
  zomatoCommissionPct: 25,
  acceptingOrders: true,
  orderingHours: DEFAULT_HOURS,
  porterEnabled: false,
  zomatoEnabled: false,
  invoiceFooter: "Thank you for ordering from Leafli!",
};

/** GST split for a subscription (plan price is excl. GST, like menu prices). */
export function subscriptionTotals(price: number, gstRate: number) {
  const half = round2((price * gstRate) / 200);
  const gross = price + half * 2;
  const total = Math.round(gross);
  return { taxableValue: price, cgst: half, sgst: half, roundOff: round2(total - gross), total };
}
