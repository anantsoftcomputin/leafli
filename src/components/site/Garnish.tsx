// Small floating ingredient illustrations used for parallax in the hero and CTA.

export function Basil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <path d="M30 4C14 12 8 28 14 44c4 10 12 12 16 12s12-2 16-12c6-16 0-32-16-40Z" fill="#3f9a4a" />
      <path d="M30 10v44M30 22l-9 8M30 30l10 8M30 38l-8 7" stroke="#b6e08a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Tomato({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <circle cx="30" cy="32" r="24" fill="#ef4b31" />
      <circle cx="30" cy="32" r="17" fill="#ff7a5c" />
      <g fill="#ffd9a8">
        <ellipse cx="22" cy="28" rx="3" ry="2" />
        <ellipse cx="37" cy="27" rx="3" ry="2" />
        <ellipse cx="30" cy="40" rx="3" ry="2" />
      </g>
      <path d="M30 32 22 28M30 32l7-5M30 32v8" stroke="#ef4b31" strokeWidth="2" />
      <circle cx="21" cy="22" r="4" fill="#fff" opacity=".35" />
    </svg>
  );
}

export function Lemon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <circle cx="30" cy="30" r="26" fill="#f6d64a" />
      <circle cx="30" cy="30" r="21" fill="#fff6c2" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M30 30 30 12A18 18 0 0 1 42.7 17.3Z" fill="#ffe56b" transform={`rotate(${i * 45} 30 30)`} stroke="#fff6c2" strokeWidth="1.4" />
      ))}
    </svg>
  );
}

export function Chilli({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <path d="M12 14c6 4 10 4 18 8 12 6 18 18 22 30-10-4-22-8-30-18-4-6-8-10-10-20Z" fill="#3f9a4a" />
      <path d="M10 10c2 4 4 4 6 6" stroke="#2c6b33" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 22c8 2 16 10 22 22" stroke="#a6dd7a" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
    </svg>
  );
}

export function Mango({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      <rect x="10" y="10" width="40" height="40" rx="10" fill="#ffb43a" transform="rotate(12 30 30)" />
      <rect x="16" y="16" width="16" height="12" rx="4" fill="#ffd77a" transform="rotate(12 30 30)" />
    </svg>
  );
}

export function Sesame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      {[[14, 20, 20], [34, 14, -30], [44, 34, 60], [22, 40, 10], [30, 28, -50]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="5" ry="2.8" fill={i % 2 ? "#fff3d6" : "#2a2a2a"} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}
