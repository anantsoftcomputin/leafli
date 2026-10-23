"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "lime";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-[background,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-leaf-700 text-white shadow-sm shadow-leaf-900/20 hover:bg-leaf-800",
        variant === "lime" && "bg-lime-400 text-leaf-900 shadow-sm hover:bg-lime-300",
        variant === "secondary" && "bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50 hover:ring-stone-300",
        variant === "ghost" && "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        variant === "danger" && "bg-red-600 text-white shadow-sm hover:bg-red-700",
        className,
      )}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  title,
  actions,
  icon,
  description,
  flush,
}: {
  className?: string;
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  /** No inner padding (tables, lists that run edge to edge). */
  flush?: boolean;
}) {
  return (
    <section className={cx("overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,35,26,.04),0_4px_16px_-8px_rgba(16,35,26,.08)] ring-1 ring-stone-900/[.06]", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-leaf-50 text-leaf-700">{icon}</span>}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-stone-900">{title}</h2>
              {description && <p className="truncate text-xs text-stone-500">{description}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

const tones = {
  gray: "bg-stone-100 text-stone-700 [--dot:var(--color-stone-400)]",
  green: "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-600/15 [--dot:var(--color-leaf-500)]",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15 [--dot:var(--color-amber-500)]",
  red: "bg-red-50 text-red-700 ring-1 ring-red-600/15 [--dot:var(--color-red-500)]",
  blue: "bg-sky-50 text-sky-800 ring-1 ring-sky-600/15 [--dot:var(--color-sky-500)]",
  violet: "bg-violet-50 text-violet-800 ring-1 ring-violet-600/15 [--dot:var(--color-violet-500)]",
};
export function Badge({ tone = "gray", children, title, dot }: { tone?: keyof typeof tones; children: React.ReactNode; title?: string; dot?: boolean }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap capitalize", tones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-[var(--dot)]" />}
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "rounded-xl border-0 bg-white px-3 py-2 text-sm ring-1 ring-stone-200 outline-none transition-shadow placeholder:text-stone-400 focus:ring-2 focus:ring-leaf-500 disabled:bg-stone-50";

/** Full width unless the caller sets its own width. */
const width = (c?: string) => (c && /(^|\s)(w-|max-w-|min-w-|flex-1)/.test(c) ? "" : "w-full");

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, "h-10", width(p.className), p.className)} />;
}
export function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, "h-10 pr-8", width(p.className), p.className)} />;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, width(p.className), p.className)} />;
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-950/40 backdrop-blur-[2px] sm:items-start sm:overflow-y-auto sm:p-8" onMouseDown={onClose} role="dialog" aria-modal aria-label={title}>
      <div
        className={cx(
          "flex max-h-[92svh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-none sm:rounded-2xl",
          wide ? "sm:max-w-4xl" : "sm:max-w-lg",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h3 className="font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/**
 * KPI tile: label, value, optional signed delta vs a named period (green when the
 * change is good), optional icon and a trend slot (e.g. a sparkline).
 */
export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
  delta,
  goodWhen = "up",
  trend,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "red" | "amber" | "green";
  icon?: React.ReactNode;
  delta?: { pct: number | null; vs: string };
  goodWhen?: "up" | "down";
  trend?: React.ReactNode;
}) {
  const good = delta?.pct != null && delta.pct !== 0 && (goodWhen === "up" ? delta.pct > 0 : delta.pct < 0);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(16,35,26,.04),0_4px_16px_-8px_rgba(16,35,26,.08)] ring-1 ring-stone-900/[.06] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-stone-500">{label}</div>
        {icon && <span className="grid size-7 place-items-center rounded-lg bg-stone-50 text-stone-500">{icon}</span>}
      </div>
      <div
        className={cx(
          "mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[1.7rem]",
          tone === "red" && "text-red-600",
          tone === "amber" && "text-amber-600",
          tone === "green" && "text-leaf-700",
        )}
      >
        {value}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
        {delta && delta.pct != null && (
          <span className={cx("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold", delta.pct === 0 ? "bg-stone-100 text-stone-600" : good ? "bg-leaf-50 text-leaf-700" : "bg-red-50 text-red-700")}>
            {delta.pct > 0 ? "▲" : delta.pct < 0 ? "▼" : "•"} {Math.abs(delta.pct).toFixed(0)}%
          </span>
        )}
        {delta && <span>{delta.pct == null ? `no data ${delta.vs}` : delta.vs}</span>}
        {sub && <span>{sub}</span>}
      </div>
      {trend && <div className="mt-3">{trend}</div>}
    </div>
  );
}

export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 px-6 py-10 text-center text-sm text-stone-500">
      {icon && <span className="grid size-10 place-items-center rounded-full bg-white text-stone-400 ring-1 ring-stone-200">{icon}</span>}
      {children}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-stone-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cx("bg-stone-50/80 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-stone-500 uppercase first:pl-5 last:pr-5", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cx("px-3 py-3 align-middle first:pl-5 last:pr-5", className)}>{children}</td>;
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-600/10">{children}</p>;
}

/** Small helper for async button handlers with an error message. */
export function useAsync() {
  return async function run<T>(fn: () => Promise<T>, setBusy: (b: boolean) => void, setErr: (e: string | null) => void) {
    setBusy(true);
    setErr(null);
    try {
      return await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
}
