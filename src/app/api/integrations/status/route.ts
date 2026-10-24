import type { NextRequest } from "next/server";
import { porterConfigured } from "@/lib/integrations/porter";
import { pingRazorpay, razorpayConfigured, razorpayMode } from "@/lib/integrations/razorpay";
import { requireUser, route } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";

export const GET = route(async (req: NextRequest) => {
  await requireUser(req, ["admin"]);
  const origin = req.nextUrl.origin;
  const [logs, rzpPing] = await Promise.all([
    col.logs().orderBy("at", "desc").limit(20).get(),
    razorpayConfigured() ? pingRazorpay() : Promise.resolve(null),
  ]);
  return {
    porter: {
      configured: porterConfigured(),
      baseUrl: process.env.PORTER_BASE_URL || "https://pfe-apigw-uat.porter.in",
      webhookConfigured: Boolean(process.env.PORTER_WEBHOOK_SECRET),
      webhookUrl: `${origin}/api/integrations/porter/webhook?token=<PORTER_WEBHOOK_SECRET>`,
    },
    zomato: {
      webhookConfigured: Boolean(process.env.ZOMATO_WEBHOOK_SECRET),
      statusCallbackConfigured: Boolean(process.env.ZOMATO_STATUS_CALLBACK_URL),
      autoAccept: process.env.ZOMATO_AUTO_ACCEPT === "true",
      webhookUrl: `${origin}/api/integrations/zomato/webhook`,
    },
    razorpay: {
      configured: razorpayConfigured(),
      mode: razorpayMode(),
      keysWork: rzpPing?.ok ?? false,
      keysError: rzpPing?.error ?? null,
      webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      webhookUrl: `${origin}/api/payments/razorpay/webhook`,
    },
    website: { menuUrl: `${origin}/api/public/menu`, ordersUrl: `${origin}/api/orders`, cors: process.env.CORS_ALLOWED_ORIGINS ?? "" },
    logs: logs.docs.map((d) => {
      const x = d.data();
      return { id: d.id, provider: x.provider, direction: x.direction, at: x.at, error: x.error ?? null, orderId: x.orderId ?? null };
    }),
  };
});
