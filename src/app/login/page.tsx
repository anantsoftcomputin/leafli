"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  RecaptchaVerifier,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { useAuth } from "@/components/AuthProvider";
import { homeFor } from "@/components/StaffShell";
import { Logo } from "@/components/brand/Logo";
import { DishImage } from "@/components/site/DishImage";

function friendly(e: unknown) {
  const code = (e as { code?: string }).code ?? "";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return null;
  if (code.includes("invalid-phone")) return "That mobile number doesn't look right.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait a few minutes and try again.";
  if (code.includes("invalid-verification-code")) return "That code didn't work. Check it and try again.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "An account with this email already exists — sign in instead, or reset your password.";
  if (code.includes("weak-password")) return "Use at least 6 characters for your password.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("account-exists-with-different-credential"))
    return "This email is already linked to Google — use “Continue with Google”.";
  if (code.includes("unauthorized-domain")) return "This domain isn't authorised for sign-in yet (Firebase → Authentication → Settings → Authorized domains).";
  const msg = (e as Error).message ?? "";
  // SMS region policy blocks this country (Firebase → Authentication → Settings → SMS region policy).
  if (/region enabled/i.test(msg)) return "We can't send OTPs to this country. Please use an Indian (+91) mobile number, or sign in with Google or email.";
  if (code.includes("operation-not-allowed")) return "This sign-in method isn't enabled yet in Firebase Authentication.";
  if (code.includes("captcha-check-failed") || code.includes("invalid-app-credential"))
    return "Security check failed. Refresh the page and try again (disable ad-blockers for this site if it keeps happening).";
  if (code.includes("quota-exceeded")) return "We've hit today's OTP limit. Please sign in with Google or email for now.";
  if (code.includes("billing-not-enabled")) return "Phone sign-in isn't available right now. Please use Google or email.";
  if (code.includes("code-expired")) return "That code has expired. Tap “Use a different number” and request a new one.";
  return (e as Error).message || "Something went wrong. Please try again.";
}

type Method = "phone" | "email";
type EmailMode = "signin" | "signup" | "reset";

function LoginInner() {
  const { user, profile, isStaff, loading } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [method, setMethod] = useState<Method>("phone");
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user && profile) router.replace(next || (isStaff ? homeFor(profile.role) : "/"));
  }, [loading, user, profile, isStaff, next, router]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo("[data-panel] > *", { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07, duration: 0.9, ease: "expo.out" });
        gsap.from("[data-orbit]", { scale: 0.5, opacity: 0, rotate: -120, stagger: 0.15, duration: 1.6, ease: "expo.out" });
        gsap.utils.toArray<HTMLElement>("[data-orbit]").forEach((el, i) => gsap.to(el, { rotate: i % 2 ? -360 : 360, duration: 70 + i * 15, repeat: -1, ease: "none" }));
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // Slide the active form in whenever the method or step changes.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo("[data-form]", { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
    },
    { scope: root, dependencies: [method, emailMode, !!confirm] },
  );

  function reset() {
    setErr(null);
    setInfo(null);
  }

  async function google() {
    reset();
    setBusy("google");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // In-app browsers (Instagram, WhatsApp) often block popups — fall back to a redirect.
      if ((e as { code?: string }).code?.includes("popup-blocked")) return signInWithRedirect(auth, provider);
      setErr(friendly(e));
    } finally {
      setBusy(null);
    }
  }

  async function sendOtp() {
    reset();
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return setErr("Enter your 10-digit mobile number");
    setBusy("otp");
    try {
      verifier.current ??= new RecaptchaVerifier(auth, "recaptcha", { size: "invisible" });
      setConfirm(await signInWithPhoneNumber(auth, `+91${digits}`, verifier.current));
    } catch (e) {
      setErr(friendly(e));
      verifier.current?.clear();
      verifier.current = null;
    } finally {
      setBusy(null);
    }
  }

  async function verifyOtp(value = code) {
    if (!confirm || value.length !== 6) return;
    reset();
    setBusy("verify");
    try {
      await confirm.confirm(value);
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitEmail() {
    reset();
    const addr = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setErr("Enter a valid email address");
    setBusy("email");
    try {
      if (emailMode === "reset") {
        await sendPasswordResetEmail(auth, addr);
        setInfo("If an account exists for that email, a reset link is on its way. Check your inbox (and spam).");
        setEmailMode("signin");
      } else if (emailMode === "signup") {
        if (!name.trim()) return setErr("Tell us your name");
        if (password.length < 6) return setErr("Use at least 6 characters for your password");
        const cred = await createUserWithEmailAndPassword(auth, addr, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await api("/api/auth/bootstrap", { name: name.trim() });
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, addr, password);
      }
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(null);
    }
  }

  const btn = "flex w-full items-center justify-center gap-3 rounded-full py-4 font-semibold transition-colors active:scale-[.98] disabled:opacity-60";
  const field = "w-full rounded-full bg-white px-5 py-4 ring-1 ring-ink/10 outline-none focus:ring-2 focus:ring-leaf-500";

  return (
    <div ref={root} className="site grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-lime-400 lg:block">
        <div data-orbit className="absolute -top-24 -left-24 w-[30rem]"><DishImage id="chicken-caesar" priority /></div>
        <div data-orbit className="absolute top-1/3 -right-32 w-[26rem]"><DishImage id="caprese" /></div>
        <div data-orbit className="absolute -bottom-28 left-10 w-[24rem]"><DishImage id="chocolate-fruit-bowl" /></div>
        <div className="absolute inset-x-12 bottom-14 rounded-3xl bg-leaf-800/85 p-8 text-cream-50 backdrop-blur-md">
          <p className="font-display text-4xl leading-tight italic">“Fresh bowls.<br />Happy moods.”</p>
          <p className="mt-3 text-cream-50/70">Sign in to order, track deliveries and reorder favourites in a tap.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div data-panel className="w-full max-w-sm">
          <Link href="/" aria-label="Back to Leafli" className="inline-block"><Logo className="h-20" /></Link>
          <h1 className="mt-8 font-display text-4xl font-medium tracking-tight">Welcome</h1>
          <p className="mt-2 text-ink/60">Sign in or create an account — it&apos;s the same step.</p>

          <button onClick={google} disabled={!!busy} className={`${btn} mt-8 bg-white text-ink ring-1 ring-ink/10 hover:ring-ink/25`}>
            <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17z" />
              <path fill="#FBBC05" d="M10.5 28.8c-.5-1.4-.8-3-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z" />
            </svg>
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="my-6 flex items-center gap-4 text-xs font-medium tracking-wide text-ink/40 uppercase">
            <div className="h-px flex-1 bg-ink/10" /> or <div className="h-px flex-1 bg-ink/10" />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1 text-sm font-semibold" role="tablist">
            {(["phone", "email"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={method === m}
                onClick={() => { setMethod(m); reset(); }}
                className={`rounded-full py-2.5 transition-colors ${method === m ? "bg-white shadow" : "text-ink/60"}`}
              >
                {m === "phone" ? "Mobile OTP" : "Email"}
              </button>
            ))}
          </div>

          {method === "phone" ? (
            !confirm ? (
              <form data-form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="space-y-3">
                <div className="flex items-center rounded-full bg-white ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-leaf-500">
                  <span className="pl-5 text-ink/50">+91</span>
                  <input inputMode="numeric" autoComplete="tel-national" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-transparent px-3 py-4 outline-none" />
                </div>
                <button type="submit" disabled={!!busy} className={`${btn} bg-leaf-700 text-cream-50 hover:bg-leaf-800`}>
                  {busy === "otp" ? "Sending code…" : "Send OTP"}
                </button>
              </form>
            ) : (
              <form data-form onSubmit={(e) => { e.preventDefault(); verifyOtp(); }} className="space-y-3">
                <p className="text-sm text-ink/60">Enter the 6-digit code sent to <b>+91 {phone.replace(/\D/g, "").slice(-10)}</b></p>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setCode(v);
                    if (v.length === 6) verifyOtp(v);
                  }}
                  className="w-full rounded-full bg-white py-4 text-center font-display text-2xl tracking-[0.6em] ring-1 ring-ink/10 outline-none focus:ring-2 focus:ring-leaf-500"
                />
                <button type="submit" disabled={!!busy || code.length !== 6} className={`${btn} bg-leaf-700 text-cream-50 hover:bg-leaf-800`}>
                  {busy === "verify" ? "Verifying…" : "Verify & continue"}
                </button>
                <button type="button" className="w-full text-sm text-ink/50 hover:underline" onClick={() => { setConfirm(null); setCode(""); }}>
                  Use a different number
                </button>
              </form>
            )
          ) : (
            <form data-form onSubmit={(e) => { e.preventDefault(); submitEmail(); }} className="space-y-3">
              {emailMode === "signup" && (
                <input className={field} placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              <input className={field} type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {emailMode !== "reset" && (
                <input
                  className={field}
                  type="password"
                  placeholder={emailMode === "signup" ? "Create a password (6+ characters)" : "Password"}
                  autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              <button type="submit" disabled={!!busy} className={`${btn} bg-leaf-700 text-cream-50 hover:bg-leaf-800`}>
                {busy === "email" ? "Please wait…" : emailMode === "signup" ? "Create account" : emailMode === "reset" ? "Send reset link" : "Sign in"}
              </button>
              <div className="flex justify-between px-2 text-sm">
                {emailMode === "signin" ? (
                  <>
                    <button type="button" className="text-leaf-700 hover:underline" onClick={() => { setEmailMode("signup"); reset(); }}>New here? Create account</button>
                    <button type="button" className="text-ink/50 hover:underline" onClick={() => { setEmailMode("reset"); reset(); }}>Forgot password?</button>
                  </>
                ) : (
                  <button type="button" className="text-leaf-700 hover:underline" onClick={() => { setEmailMode("signin"); reset(); }}>← Back to sign in</button>
                )}
              </div>
            </form>
          )}

          {info && <p role="status" className="mt-4 rounded-2xl bg-lime-300/50 px-4 py-3 text-sm text-leaf-800">{info}</p>}
          {err && <p role="alert" className="mt-4 rounded-2xl bg-tomato/10 px-4 py-3 text-sm text-tomato">{err}</p>}
          <p className="mt-10 text-xs text-ink/40">By continuing you agree to receive order updates on this number or email.</p>
          <div id="recaptcha" />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
