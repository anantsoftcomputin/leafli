import "server-only";
import { NextResponse, type NextRequest } from "next/server";

// Origins allowed to call the public/order APIs from the browser (e.g. https://leafli.in).
const ALLOWED = (process.env.CORS_ALLOWED_ORIGINS || "https://leafli.in,https://www.leafli.in")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    vary: "origin",
  };
}

export const preflight = (req: NextRequest) => new NextResponse(null, { status: 204, headers: corsHeaders(req) });

export function withCors(req: NextRequest, res: Response) {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}
