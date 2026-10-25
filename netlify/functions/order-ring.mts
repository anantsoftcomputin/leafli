// Every minute: ask the app to ring staff phones again for orders nobody has accepted yet.
export default async () => {
  const base = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!base || !process.env.CRON_SECRET) return new Response("CRON_SECRET / URL not set", { status: 200 });
  const res = await fetch(`${base}/api/orders/ring`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  return new Response(await res.text(), { status: res.status });
};

export const config = { schedule: "* * * * *" };
