// Website ordering hours (India time). Shared by the storefront and the order API, so the
// "kitchen closed" message customers see is exactly the rule the server enforces.

export interface OrderingHours {
  opens: string; // "HH:MM", 24-hour, IST
  closes: string;
}

export const DEFAULT_HOURS: OrderingHours = { opens: "11:00", closes: "21:00" };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minutes since midnight in India time. */
export const istMinutes = (d = new Date()) => {
  const t = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};

/** "21:00" → "9 pm", "11:30" → "11:30 am". */
export function formatTime(hhmm: string) {
  const min = toMin(hhmm);
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

export const hoursLabel = (h: OrderingHours = DEFAULT_HOURS) => `${formatTime(h.opens)} – ${formatTime(h.closes)}`;

export interface KitchenStatus {
  open: boolean;
  /** Customer-facing explanation when closed. */
  message: string;
}

/**
 * Is the kitchen taking website orders right now? Combines the manual on/off switch
 * with the ordering hours (which may run past midnight, e.g. 18:00–02:00).
 */
export function kitchenStatus(s: { acceptingOrders: boolean; orderingHours?: OrderingHours | null }, now = new Date()): KitchenStatus {
  const h = s.orderingHours?.opens && s.orderingHours?.closes ? s.orderingHours : DEFAULT_HOURS;
  const opens = toMin(h.opens);
  const closes = toMin(h.closes);
  const t = istMinutes(now);
  if (!s.acceptingOrders) return { open: false, message: "Our kitchen is closed right now and isn't taking orders. Please check back a little later." };
  const inHours = opens === closes ? true : opens < closes ? t >= opens && t < closes : t >= opens || t < closes;
  if (inHours) return { open: true, message: "" };
  const later = opens < closes ? t < opens : true;
  return {
    open: false,
    message: later
      ? `Our kitchen is closed right now — we start taking orders at ${formatTime(h.opens)}. See you soon!`
      : `Our kitchen is closed for the day. We take orders from ${formatTime(h.opens)} to ${formatTime(h.closes)} — order again tomorrow from ${formatTime(h.opens)}.`,
  };
}
