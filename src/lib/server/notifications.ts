import "server-only";
import * as email from "./email/notify";
import * as wa from "./whatsapp/notify";

/**
 * One call per business event; each channel decides for itself whether it applies
 * (opt-in, recipient available, configured). Channels never throw.
 */
type Target = { kind: "order" | "subscription"; id: string };

export const onWelcome = (u: Parameters<typeof email.emailWelcome>[0]) => email.emailWelcome(u);

export const onOrderLive = (orderId: string) => Promise.all([email.emailOrderLive(orderId), wa.waOrderLive(orderId)]);
export const onOrderStatus = (orderId: string, status: string) =>
  Promise.all([email.emailOrderStatus(orderId, status), wa.waOrderStatus(orderId, status)]);
export const onPaymentLink = (orderId: string, url: string) =>
  Promise.all([email.emailPaymentLink(orderId, url), wa.waPaymentLink(orderId, url)]);

export const onRefundStarted = (t: Target, a: { refundId: string; amount: number; full: boolean; reason?: string }) =>
  Promise.all([email.emailRefundStarted(t, a), wa.waRefundStarted(t, a)]);
export const onRefundCompleted = (t: Target, a: { refundId: string; amount: number }) =>
  Promise.all([email.emailRefundCompleted(t, a), wa.waRefundCompleted(t, a)]);
export const onStaffIssue = (a: { key: string; title: string; detail: string; url: string }) =>
  Promise.all([email.emailStaffIssue(a), wa.waStaffIssue(a)]);

export const onSubscriptionCreated = (id: string) => Promise.all([email.emailSubscriptionCreated(id), wa.waSubscriptionCreated(id)]);
export const onSubscriptionActive = (id: string) => Promise.all([email.emailSubscriptionActive(id), wa.waSubscriptionActive(id)]);
export const onSubscriptionChanged = (id: string, change: "paused" | "resumed" | "cancelled") =>
  Promise.all([email.emailSubscriptionChanged(id, change), wa.waSubscriptionChanged(id, change)]);
export const onSubscriptionEndingSoon = (id: string, left: number) =>
  Promise.all([email.emailSubscriptionEndingSoon(id, left), wa.waSubscriptionEndingSoon(id, left)]);
export const onSubscriptionFinished = (id: string, expired: boolean) =>
  Promise.all([email.emailSubscriptionFinished(id, expired), wa.waSubscriptionFinished(id, expired)]);
