// Tax-invoice data for a subscription plan, shared by the API and the invoice pages.
import type { Address, BusinessSettings, Subscription } from "./types";

export interface SubscriptionInvoice {
  seller: Pick<BusinessSettings, "name" | "legalName" | "gstin" | "fssai" | "phone" | "email" | "address" | "invoiceFooter" | "gstRate">;
  invoiceNo: string;
  invoiceDate: number;
  placeOfSupply: string;
  buyer: { name: string; phone?: string; email?: string | null; address: Address };
  plan: { name: string; meals: number; startDate: string; endDate: string; slot: Subscription["slot"] };
  taxableValue: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  payment: { mode: Subscription["paymentMode"]; method?: string; paymentId?: string; paidAt?: number; refundedAmount?: number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSubscriptionInvoice(s: Subscription, settings: BusinessSettings): SubscriptionInvoice | null {
  if (!s.invoiceNo) return null;
  return {
    seller: {
      name: settings.name,
      legalName: settings.legalName,
      gstin: settings.gstin,
      fssai: settings.fssai,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      invoiceFooter: settings.invoiceFooter,
      gstRate: settings.gstRate,
    },
    invoiceNo: s.invoiceNo,
    invoiceDate: s.invoicedAt ?? s.payment?.paidAt ?? s.updatedAt,
    // Intra-state supply (CGST + SGST): the kitchen and every delivery are in Gujarat.
    placeOfSupply: "Gujarat (24)",
    buyer: { name: s.customer.name, phone: s.customer.phone, email: s.customer.email, address: s.address },
    plan: { name: s.planName, meals: s.mealsTotal, startDate: s.startDate, endDate: s.endDate, slot: s.slot },
    taxableValue: s.taxableValue,
    cgst: s.cgst,
    sgst: s.sgst,
    roundOff: s.roundOff ?? round2(s.total - (s.taxableValue + s.cgst + s.sgst)),
    total: s.total,
    payment: { mode: s.paymentMode, method: s.payment?.method, paymentId: s.payment?.paymentId, paidAt: s.payment?.paidAt, refundedAmount: s.payment?.refundedAmount },
  };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const three = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", n % 100 ? two(n % 100) : ""].filter(Boolean).join(" ");

/** 2204 → "Rupees Two Thousand Two Hundred Four Only" (Indian system: lakh, crore). */
export function rupeesInWords(amount: number) {
  let n = Math.round(amount);
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  for (const [size, label] of [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]] as const) {
    if (n >= size) {
      parts.push(`${three(Math.floor(n / size))} ${label}`);
      n %= size;
    }
  }
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(" ")} Only`;
}
