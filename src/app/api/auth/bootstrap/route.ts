import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { HttpError, route } from "@/lib/server/http";
import type { Role } from "@/lib/types";
import { emailWelcome } from "@/lib/server/email/notify";

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * Called after every sign-in. Creates the user profile on first login. Emails or
 * phone numbers listed in ADMIN_EMAILS / ADMIN_PHONES are made admins, so the
 * owner can bootstrap the system; everyone else starts as a customer and is
 * promoted from Settings → Team.
 */
export const POST = route(async (req: NextRequest) => {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "Sign in required");
  const decoded = await adminAuth.verifyIdToken(token).catch(() => {
    throw new HttpError(401, "Session expired — please sign in again");
  });
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const ref = adminDb.collection("users").doc(decoded.uid);
  const snap = await ref.get();
  const email = decoded.email?.toLowerCase() ?? null;
  const phone = decoded.phone_number ?? null;
  // Only a *verified* email can claim admin. Anyone can register an email/password
  // account with any address, so an unverified match must never grant access.
  const isAdmin =
    (email && decoded.email_verified === true && list(process.env.ADMIN_EMAILS).includes(email)) ||
    (phone && list(process.env.ADMIN_PHONES).includes(phone.toLowerCase()));

  if (!snap.exists) {
    const profile = {
      uid: decoded.uid,
      name: body.name || decoded.name || phone || email || "Leafli user",
      email,
      phone,
      role: (isAdmin ? "admin" : "customer") as Role,
      addresses: [],
      createdAt: Date.now(),
    };
    await ref.set(profile);
    if (profile.role === "customer") await emailWelcome(profile);
    return profile;
  }
  const data = snap.data()!;
  const patch: Record<string, unknown> = {};
  if (isAdmin && data.role !== "admin") patch.role = "admin";
  if (email && !data.email) patch.email = email;
  if (phone && !data.phone) patch.phone = phone;
  // Replace a placeholder name (email/phone) once the user gives us a real one.
  if (body.name && (!data.name || data.name === email || data.name === phone || data.name === "Leafli user")) patch.name = body.name;
  if (Object.keys(patch).length) await ref.update(patch);
  return { ...data, ...patch };
});
