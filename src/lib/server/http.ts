import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Actor {
  uid: string;
  role: Role;
  name: string;
}

/** Verifies the Firebase ID token and (optionally) that the user has one of `roles`. */
export async function requireUser(req: NextRequest, roles?: Role[]): Promise<Actor> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Sign in required");
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Session expired — please sign in again");
  }
  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  const role = (snap.get("role") as Role | undefined) ?? "customer";
  if (roles && !roles.includes(role)) throw new HttpError(403, "You do not have permission to do this");
  return {
    uid: decoded.uid,
    role,
    name: (snap.get("name") as string) || decoded.name || decoded.phone_number || decoded.email || "User",
  };
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>;

/** Wraps a route handler: JSON-encodes the result and maps errors to status codes. */
export function route(fn: Handler) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: (e as Error).message || "Server error" }, { status: 500 });
    }
  };
}

export const STAFF: Role[] = ["admin", "manager", "kitchen", "cashier"];
export const MANAGERS: Role[] = ["admin", "manager"];
