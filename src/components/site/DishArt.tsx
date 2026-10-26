// Top-down bowl illustrations built from each dish's SOP ingredients.
// Every ingredient piece carries `data-piece` so GSAP can animate it.

type Shape = "leaf" | "blob" | "cube" | "disc" | "strand" | "slice" | "seed" | "half";
interface Layer {
  shape: Shape;
  colors: string[];
  count: number;
  size: number; // relative to a 200-unit viewBox
  rings?: [number, number]; // radial band to place pieces in (0 = centre, 1 = rim)
}
interface Recipe {
  base: string;
  rim: string;
  bowl: string;
  layers: Layer[];
  spiral?: { colors: string[]; count: number };
}

export const DISH_THEME: Record<string, { bg: string; fg: string; accent: string; tag: string }> = {
  "chicken-caesar": { bg: "#e9f1d8", fg: "#1f4d33", accent: "#c9a14a", tag: "Protein-packed" },
  "asian-rice-noodle": { bg: "#efe2f2", fg: "#4b2560", accent: "#f08a2c", tag: "Sesame & soy" },
  "chana-moong": { bg: "#fbecc9", fg: "#5a3b10", accent: "#ef5b3c", tag: "High-fibre desi" },
  caprese: { bg: "#fde3dc", fg: "#7a1f14", accent: "#3f7a4f", tag: "Italian classic" },
  "potato-apple": { bg: "#f6eccd", fg: "#4a3410", accent: "#b4365e", tag: "Tangy & hearty" },
  "potato-apple-eggless": { bg: "#f6eccd", fg: "#4a3410", accent: "#b4365e", tag: "Eggless · Tangy & hearty" },
  "chocolate-fruit-bowl": { bg: "#f3dde4", fg: "#4a1e2e", accent: "#e2397a", tag: "Guilt-light dessert" },
};

const RECIPES: Record<string, Recipe> = {
  "chicken-caesar": {
    base: "#cfe3a8", rim: "#ffffff", bowl: "#f4efe3",
    layers: [
      { shape: "leaf", colors: ["#7fb35a", "#9cc96d", "#5f9a45", "#b6d982"], count: 26, size: 26, rings: [0, 0.95] },
      { shape: "slice", colors: ["#d9a066", "#c98d52", "#e4b27c"], count: 7, size: 24, rings: [0.1, 0.7] },
      { shape: "cube", colors: ["#e8b86d", "#d9a24f"], count: 9, size: 10, rings: [0.2, 0.9] },
      { shape: "half", colors: ["#e8402d", "#f2593f"], count: 5, size: 13, rings: [0.4, 0.9] },
      { shape: "disc", colors: ["#fff8e6"], count: 2, size: 20, rings: [0.25, 0.5] },
      { shape: "seed", colors: ["#f4e9c9"], count: 22, size: 3, rings: [0, 0.9] },
    ],
  },
  "asian-rice-noodle": {
    base: "#f3e3bf", rim: "#ffffff", bowl: "#2b2b2b",
    layers: [
      { shape: "strand", colors: ["#f6ead0", "#efdcb4", "#fff4dc"], count: 28, size: 60, rings: [0, 0.85] },
      { shape: "strand", colors: ["#7b3f8c", "#94529f"], count: 12, size: 34, rings: [0.2, 0.95] },
      { shape: "strand", colors: ["#f08a2c", "#f6a04a"], count: 12, size: 30, rings: [0.2, 0.95] },
      { shape: "leaf", colors: ["#3f9a4a", "#5bb35f"], count: 10, size: 14, rings: [0, 0.9] },
      { shape: "blob", colors: ["#d29a5b", "#c4864a"], count: 9, size: 8, rings: [0.1, 0.8] },
      { shape: "seed", colors: ["#fff6de", "#2a2a2a"], count: 26, size: 2.6, rings: [0, 0.9] },
    ],
  },
  "chana-moong": {
    base: "#e9d3a4", rim: "#ffffff", bowl: "#f6efe2",
    layers: [
      { shape: "blob", colors: ["#d9b47a", "#e3c18c", "#caa265"], count: 26, size: 11, rings: [0, 0.95] },
      { shape: "blob", colors: ["#8fb84a", "#7aa63b"], count: 30, size: 6, rings: [0, 0.95] },
      { shape: "cube", colors: ["#e8402d"], count: 8, size: 9, rings: [0.1, 0.9] },
      { shape: "cube", colors: ["#b9d98a", "#d8ecb6"], count: 8, size: 9, rings: [0.1, 0.9] },
      { shape: "cube", colors: ["#ffb43a", "#ffc65a"], count: 8, size: 10, rings: [0.1, 0.9] },
      { shape: "cube", colors: ["#f2e8f2", "#d8b7d8"], count: 6, size: 7, rings: [0.1, 0.9] },
      { shape: "leaf", colors: ["#3f9a4a"], count: 7, size: 10, rings: [0.1, 0.9] },
    ],
  },
  caprese: {
    base: "#6aa04a", rim: "#ffffff", bowl: "#f7f3ea",
    layers: [{ shape: "leaf", colors: ["#4f8a36", "#6aa04a", "#3d7a2c"], count: 30, size: 18, rings: [0.7, 1] }],
    spiral: { colors: ["#e8402d", "#fffaf0"], count: 13 },
  },
  "potato-apple": {
    base: "#cfe3a8", rim: "#ffffff", bowl: "#f2ece0",
    layers: [
      { shape: "leaf", colors: ["#9cc96d", "#b6d982"], count: 14, size: 24, rings: [0.5, 1] },
      { shape: "cube", colors: ["#e5b04f", "#d99c3a", "#efc06a"], count: 18, size: 18, rings: [0, 0.8] },
      { shape: "slice", colors: ["#f3eab0"], count: 6, size: 18, rings: [0.2, 0.85] },
      { shape: "half", colors: ["#e8402d"], count: 4, size: 12, rings: [0.3, 0.9] },
      { shape: "blob", colors: ["#7a4a24", "#8e5a2e"], count: 7, size: 9, rings: [0.1, 0.8] },
    ],
  },
  "chocolate-fruit-bowl": {
    base: "#5a3423", rim: "#ffffff", bowl: "#f7f1e8",
    layers: [
      { shape: "cube", colors: ["#e2397a", "#ea4f8a"], count: 9, size: 17, rings: [0.15, 0.85] },
      { shape: "seed", colors: ["#1a1a1a"], count: 30, size: 1.6, rings: [0.15, 0.85] },
      { shape: "disc", colors: ["#a7c957", "#7b3f8c", "#9bbf4b"], count: 10, size: 12, rings: [0.1, 0.9] },
      { shape: "slice", colors: ["#ff9a2e", "#ffac45"], count: 6, size: 18, rings: [0.2, 0.9] },
      { shape: "seed", colors: ["#d6a45c", "#c48f45", "#e4b874"], count: 34, size: 3.4, rings: [0, 0.6] },
    ],
  },
};

// Deterministic PRNG so server and client render the same art.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = 78; // inner bowl radius

function piece(shape: Shape, color: string, s: number, key: string, x: number, y: number, rot: number) {
  const t = `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})`;
  const common = { "data-piece": "", key, transform: t } as const;
  switch (shape) {
    case "leaf":
      return (
        <g {...common}>
          <path d={`M0 ${-s / 2}C${s / 2.6} ${-s / 4} ${s / 2.6} ${s / 4} 0 ${s / 2}C${-s / 2.6} ${s / 4} ${-s / 2.6} ${-s / 4} 0 ${-s / 2}Z`} fill={color} />
          <path d={`M0 ${-s / 2.4}V${s / 2.4}`} stroke="#ffffff" strokeOpacity=".35" strokeWidth=".8" />
        </g>
      );
    case "blob":
      return <ellipse {...common} rx={s / 2} ry={s / 2.4} fill={color} />;
    case "cube":
      return <rect {...common} x={-s / 2} y={-s / 2} width={s} height={s} rx={s / 5} fill={color} />;
    case "disc":
      return <circle {...common} r={s / 2} fill={color} />;
    case "seed":
      return <ellipse {...common} rx={s / 2} ry={s / 3.2} fill={color} />;
    case "half":
      return (
        <g {...common}>
          <circle r={s / 2} fill={color} />
          <circle r={s / 3.4} fill="#ffd2c4" opacity=".55" />
        </g>
      );
    case "slice":
      return (
        <g {...common}>
          <path d={`M${-s / 2} 0A${s / 2} ${s / 2} 0 0 1 ${s / 2} 0Z`} fill={color} />
          <path d={`M${-s / 2.6} -1A${s / 2.6} ${s / 2.6} 0 0 1 ${s / 2.6} -1`} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1" fill="none" />
        </g>
      );
    case "strand":
      return (
        <path
          {...common}
          d={`M${-s / 2} 0C${-s / 4} ${-s / 6} ${s / 4} ${s / 6} ${s / 2} 0`}
          stroke={color}
          strokeWidth={s > 40 ? 3.2 : 2.6}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

export function DishArt({ id, className, title }: { id: string; className?: string; title?: string }) {
  const r = RECIPES[id] ?? RECIPES["chicken-caesar"]!;
  const rand = rng(id);
  const pieces: React.ReactNode[] = [];

  r.layers.forEach((layer, li) => {
    const [a, b] = layer.rings ?? [0, 1];
    for (let i = 0; i < layer.count; i++) {
      const dist = Math.sqrt(a * a + rand() * (b * b - a * a)) * (R - layer.size / 3);
      const ang = rand() * Math.PI * 2;
      const color = layer.colors[i % layer.colors.length]!;
      pieces.push(piece(layer.shape, color, layer.size * (0.8 + rand() * 0.4), `${li}-${i}`, 100 + Math.cos(ang) * dist, 100 + Math.sin(ang) * dist, rand() * 360));
    }
  });

  // Caprese "tornado": tomato & mozzarella rounds alternating in a spiral (per SOP §3.4).
  if (r.spiral) {
    for (let i = 0; i < r.spiral.count; i++) {
      const t = i / r.spiral.count;
      const ang = t * Math.PI * 3.4;
      const dist = 8 + t * 50;
      const color = r.spiral.colors[i % 2]!;
      const x = 100 + Math.cos(ang) * dist;
      const y = 100 + Math.sin(ang) * dist;
      pieces.push(
        <g data-piece="" key={`sp-${i}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
          <circle r={14 - t * 3} fill={color} stroke="#00000014" />
          {i % 2 === 0 && <circle r={8 - t * 2} fill="#ffb3a1" opacity=".5" />}
          {i % 3 === 0 && <path d="M-3 -9C2 -12 7 -7 3 -2C0 1 -5 -4 -3 -9Z" fill="#2f7a2a" transform="translate(4 2)" />}
        </g>,
      );
    }
  }

  return (
    <svg viewBox="0 0 200 200" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`shade-${id}`} cx="50%" cy="45%" r="55%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".18" />
        </radialGradient>
        <clipPath id={`clip-${id}`}>
          <circle cx="100" cy="100" r={R} />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="108" rx="96" ry="94" fill="#000" opacity=".12" data-shadow="" />
      <circle cx="100" cy="100" r="95" fill={r.bowl} data-bowl="" />
      <circle cx="100" cy="100" r="88" fill="none" stroke={r.rim} strokeOpacity=".6" strokeWidth="2" />
      <g clipPath={`url(#clip-${id})`}>
        <circle cx="100" cy="100" r={R} fill={r.base} />
        <g data-pieces="">{pieces}</g>
        <circle cx="100" cy="100" r={R} fill={`url(#shade-${id})`} />
      </g>
      <path d="M40 58A72 72 0 0 1 92 26" stroke="#fff" strokeOpacity=".5" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
