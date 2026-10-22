const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Official Leafli wordmark ("leafli" script + "You choose everyday"), from leafli.in. */
export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <img
      src={tone === "dark" ? "/brand/leafli-wordmark.png" : "/brand/leafli-wordmark-light.png"}
      alt="Leafli — you choose everyday"
      width={668}
      height={524}
      className={cx("h-12 w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Small decorative leaf used for separators and confetti (not the logo). */
export function LeafMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path data-leaf-body d="M24 4C12 10 6 20 8 31c1.6 8.6 8.6 13 16 13s14.4-4.4 16-13C42 20 36 10 24 4Z" fill="currentColor" />
      <path data-leaf-vein d="M24 10v28" stroke="var(--logo-vein, #bfcd30)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
