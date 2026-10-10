// Logical canvas coordinates. All strokes & sugar are stored in this space,
// so resizing the on-screen canvas never shifts them.
export const W = 1600;
export const H = 800;

export type Sauce = {
  id: string;
  name: string;
  color: string;
  dark: string;
  light: string;
  width: number;
  wobble: number;
};

export const SAUCES: Sauce[] = [
  { id: "ketchup", name: "케첩", color: "#d7261e", dark: "#8e140f", light: "#ff8a7a", width: 16, wobble: 0 },
  { id: "mustard", name: "머스터드", color: "#f2c21b", dark: "#a07a06", light: "#fff2a0", width: 14, wobble: 0.25 },
  { id: "mayo", name: "마요네즈", color: "#fbf4dc", dark: "#b9a77a", light: "#ffffff", width: 16, wobble: 0.1 },
  { id: "sriracha", name: "스리라차", color: "#b0160e", dark: "#5e0904", light: "#e8584a", width: 13, wobble: 0.05 },
  { id: "cheese", name: "치즈", color: "#f7a21b", dark: "#a8600a", light: "#ffd98a", width: 22, wobble: 0.15 },
  { id: "bbq", name: "바비큐", color: "#5a2a14", dark: "#2a1006", light: "#a8653c", width: 15, wobble: 0.05 },
];

export type Stroke = { sauce: string; pts: [number, number, number][] }; // x,y,widthFactor
export type Grain = { x: number; y: number; r: number; a: number; rot: number };
export type SugarBatch = { grains: Grain[]; t: number };

const BODY = { x0: 170, x1: 1230, cy: 400, r: 165 };

export function bodyPath() {
  const p = new Path2D();
  const { x0, x1, cy, r } = BODY;
  // corn-dog style rounded, slightly bumpy capsule
  p.moveTo(x0 + r, cy - r);
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const x = x0 + r + ((x1 - x0 - 2 * r) * i) / n;
    p.lineTo(x, cy - r + Math.sin(i * 1.7) * 5);
  }
  p.arc(x1 - r, cy, r, -Math.PI / 2, Math.PI / 2);
  for (let i = n; i >= 0; i--) {
    const x = x0 + r + ((x1 - x0 - 2 * r) * i) / n;
    p.lineTo(x, cy + r + Math.sin(i * 2.3) * 5);
  }
  p.arc(x0 + r, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
  p.closePath();
  return p;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function makeGrains(count: number, rand: () => number = Math.random): Grain[] {
  const path = bodyPath();
  const c = document.createElement("canvas").getContext("2d")!;
  const out: Grain[] = [];
  while (out.length < count) {
    const x = BODY.x0 + rand() * (BODY.x1 - BODY.x0);
    const y = BODY.cy - BODY.r + rand() * BODY.r * 2;
    if (!c.isPointInPath(path, x, y)) continue;
    out.push({ x, y, r: 2 + rand() * 3.2, a: 0.7 + rand() * 0.3, rot: rand() * Math.PI });
  }
  return out;
}

export function initialSugar(): SugarBatch {
  return { grains: makeGrains(650, rng(42)), t: 0 };
}

export function drawBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#f6ecd8";
  ctx.fillRect(0, 0, W, H);
  // board
  const bx = 40, by = 90, bw = 1520, bh = 620, br = 60;
  ctx.save();
  ctx.fillStyle = "rgba(120,80,40,0.12)";
  roundRect(ctx, bx + 6, by + 14, bw, bh, br);
  ctx.fill();
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.fillStyle = "#d8a873";
  ctx.fill();
  ctx.clip();
  const r = rng(7);
  ctx.lineCap = "round";
  for (let i = 0; i < 34; i++) {
    const y = by + 10 + i * 18 + r() * 8;
    ctx.strokeStyle = `rgba(150,95,50,${0.08 + r() * 0.1})`;
    ctx.lineWidth = 1.5 + r() * 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    for (let x = bx; x <= bx + bw; x += 80) ctx.lineTo(x, y + Math.sin(x / 140 + i) * 4);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(150,95,50,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(1380, 230, 22, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "#b9844f";
  ctx.lineWidth = 5;
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.stroke();
  // hanging hole
  ctx.fillStyle = "#f6ecd8";
  ctx.beginPath();
  ctx.arc(bx + bw - 60, by + 60, 16, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHotdog(ctx: CanvasRenderingContext2D) {
  const { x1, cy } = BODY;
  // shadow
  ctx.fillStyle = "rgba(90,50,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(800, cy + 185, 640, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  // stick
  ctx.fillStyle = "#ead2a3";
  ctx.strokeStyle = "#b8925a";
  ctx.lineWidth = 4;
  roundRect(ctx, x1 - 60, cy - 22, 380, 44, 22);
  ctx.fill();
  ctx.stroke();
  // body
  const p = bodyPath();
  ctx.save();
  ctx.fillStyle = "#e3a043";
  ctx.fill(p);
  ctx.clip(p);
  const g = ctx.createLinearGradient(0, cy - 165, 0, cy + 165);
  g.addColorStop(0, "rgba(255,225,140,0.7)");
  g.addColorStop(0.45, "rgba(255,200,100,0)");
  g.addColorStop(1, "rgba(150,70,20,0.35)");
  ctx.fillStyle = g;
  ctx.fill(p);
  // crumb texture
  const r = rng(99);
  for (let i = 0; i < 900; i++) {
    const x = 170 + r() * 1060, y = cy - 165 + r() * 330;
    ctx.fillStyle = r() > 0.5 ? "rgba(170,90,25,0.25)" : "rgba(255,215,130,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 2 + r() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "#9c5a1c";
  ctx.lineWidth = 5;
  ctx.stroke(p);
}

export function drawSugar(ctx: CanvasRenderingContext2D, batches: SugarBatch[], now: number) {
  const p = bodyPath();
  ctx.save();
  ctx.clip(p);
  const extra = batches.length - 1;
  if (extra > 0) {
    ctx.fillStyle = `rgba(255,252,245,${Math.min(0.62, extra * 0.075)})`;
    ctx.fill(p);
  }
  for (const b of batches) {
    const k = b.t ? Math.min(1, (now - b.t) / 450) : 1;
    const drop = (1 - k) * -60;
    for (const gr of b.grains) {
      ctx.globalAlpha = gr.a * k;
      ctx.fillStyle = "#ffffff";
      ctx.save();
      ctx.translate(gr.x, gr.y + drop * (0.5 + (gr.r % 1)));
      ctx.rotate(gr.rot);
      ctx.fillRect(-gr.r / 2, -gr.r / 2, gr.r, gr.r);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const sauce = SAUCES.find((x) => x.id === s.sauce) ?? SAUCES[0];
  const pts = s.pts;
  if (!pts.length) return;
  const pass = (color: string, wMul: number, dx: number, dy: number, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0] + dx, pts[0][1] + dy, (sauce.width * wMul) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      ctx.lineWidth = sauce.width * wMul * b[2];
      ctx.beginPath();
      ctx.moveTo(a[0] + dx, a[1] + dy);
      ctx.lineTo(b[0] + dx, b[1] + dy);
      ctx.stroke();
    }
  };
  pass("rgba(60,25,5,0.28)", 1.15, 2, 5); // drop shadow
  pass(sauce.dark, 1.18, 0, 0); // outline (keeps mayo visible)
  pass(sauce.color, 1, 0, 0);
  pass(sauce.light, 0.32, -sauce.width * 0.18, -sauce.width * 0.2, 0.75); // gloss
  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
