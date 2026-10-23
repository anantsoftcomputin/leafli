"use client";

// Lightweight SVG charts for the admin, following the dataviz rules:
// thin marks (2px lines, ≤24px bars with 4px rounded data-ends), area wash at ~10%,
// hairline recessive grid, selective direct labels, hover tooltips on every chart,
// text in ink tokens (never the series colour), legend for ≥2 series.
import { useEffect, useRef, useState } from "react";

export const CHART = {
  surface: "#ffffff",
  grid: "#efeee9",
  axis: "#8a897f",
  ink: "#1c1b17",
  muted: "#6b6a62",
  series: "#2d6a39", // single-series accent (brand leaf)
  deemph: "#c9c8bf",
  // Validated categorical order (dataviz validator: CVD ΔE 9.2, all checks pass)
  channel: { pos: "#2a78d6", zomato: "#eb6834", website: "#1baf7a" } as Record<string, string>,
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e!.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round up to a "nice" axis maximum (1, 2, 2.5, 5 × 10^n). */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
export const compact = (n: number) =>
  n >= 1e7 ? `${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`;

/** 12-ish point trend line for stat tiles: de-emphasised line, accent on the latest point. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 32;
  if (values.length < 2) return <div ref={ref} className="h-8" />;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1]!;
  return (
    <div ref={ref} className="h-8" role="img" aria-label={label}>
      {w > 0 && (
        <svg width={w} height={h} className="overflow-visible">
          <path d={`${d}L${w},${h}L0,${h}Z`} fill={CHART.series} opacity={0.08} />
          <path d={d} fill="none" stroke={CHART.deemph} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={lx} cy={ly} r={4} fill={CHART.series} stroke={CHART.surface} strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}

export interface Point {
  label: string; // x tick (e.g. "Mon 19")
  value: number;
  detail?: string; // extra tooltip line
}

/** Single-series area chart with crosshair + tooltip. */
export function AreaChart({ points, format, height = 240, label }: { points: Point[]; format: (n: number) => string; height?: number; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 56, t: 16, b: 26 };
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const x = (i: number) => pad.l + (points.length > 1 ? (i / (points.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = points.length ? `${line}L${x(points.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z` : "";
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 64))));
  const last = points.length - 1;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - pad.l;
    const i = Math.round((px / Math.max(iw, 1)) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {w > 0 && points.length > 0 && (
        <svg width={w} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-pan-y">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.axis} className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 || i === last ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize={11} fill={CHART.axis}>
                {p.label}
              </text>
            ) : null,
          )}
          <path d={area} fill={CHART.series} opacity={0.1} />
          <path d={line} fill="none" stroke={CHART.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Direct label on the latest value only */}
          <circle cx={x(last)} cy={y(points[last]!.value)} r={4.5} fill={CHART.series} stroke={CHART.surface} strokeWidth={2} />
          <text x={x(last) + 9} y={y(points[last]!.value)} dy="0.32em" fontSize={12} fontWeight={600} fill={CHART.ink}>
            {format(points[last]!.value)}
          </text>
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={CHART.axis} strokeWidth={1} />
              <circle cx={x(hover)} cy={y(points[hover]!.value)} r={5} fill={CHART.series} stroke={CHART.surface} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hover != null && w > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl bg-stone-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
          style={{ left: Math.min(Math.max(x(hover), 70), w - 70) }}
        >
          <div className="text-white/60">{points[hover]!.label}</div>
          <div className="text-sm font-semibold">{format(points[hover]!.value)}</div>
          {points[hover]!.detail && <div className="text-white/60">{points[hover]!.detail}</div>}
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars (single series) with the value at each tip. */
export function BarList({ rows, format, empty = "No data yet" }: { rows: { label: string; value: number; detail?: string }[]; format: (n: number) => string; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length || max === 0) return <p className="py-6 text-center text-sm text-stone-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className="relative">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-stone-700">{r.label}</span>
            <span className="shrink-0 font-semibold text-stone-900 tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-r-[4px]">
            <div
              className="h-full rounded-r-[4px] transition-[width,opacity] duration-700"
              style={{ width: `${(r.value / max) * 100}%`, background: CHART.series, opacity: hover == null || hover === i ? 1 : 0.45 }}
            />
          </div>
          {hover === i && r.detail && (
            <div className="pointer-events-none absolute -top-9 right-0 z-10 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs text-white shadow-lg">{r.detail}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** 100% share bar with a legend (identity never by colour alone). */
export function ShareBar({ segments, format }: { segments: { key: string; label: string; value: number }[]; format: (n: number) => string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  if (!total) return <p className="py-6 text-center text-sm text-stone-500">No sales in this period</p>;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={shown.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}>
        {shown.map((s) => (
          <div
            key={s.key}
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover(null)}
            title={`${s.label}: ${format(s.value)} (${Math.round((s.value / total) * 100)}%)`}
            className="h-full transition-opacity"
            style={{ width: `${(s.value / total) * 100}%`, background: CHART.channel[s.key] ?? CHART.deemph, opacity: hover && hover !== s.key ? 0.4 : 1 }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm" onPointerEnter={() => setHover(s.key)} onPointerLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: CHART.channel[s.key] ?? CHART.deemph }} />
            <span className="flex-1 text-stone-700">{s.label}</span>
            <span className="text-stone-500 tabular-nums">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            <span className="w-20 text-right font-semibold text-stone-900 tabular-nums">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Meter for a ratio with a target (fill colour = status, track = lighter step). */
export function Meter({ value, target, max = 60 }: { value: number; target: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const state = value <= target ? "good" : value <= target + 5 ? "warn" : "bad";
  const fill = { good: "bg-leaf-600", warn: "bg-amber-500", bad: "bg-red-500" }[state];
  const track = { good: "bg-leaf-100", warn: "bg-amber-100", bad: "bg-red-100" }[state];
  return (
    <div className={`relative h-2 rounded-full ${track}`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      <div className="absolute -top-1 h-4 w-0.5 rounded bg-stone-500" style={{ left: `${(target / max) * 100}%` }} title={`Target ${target}%`} />
    </div>
  );
}
