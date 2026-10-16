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
  gloss: number; // highlight strength 0..1
  edge: number; // outline width multiplier
};

export const SAUCES: Sauce[] = [
  { id: "ketchup", name: "케첩", color: "#d7261e", dark: "#8e140f", light: "#ff9a8a", width: 16, wobble: 0.06, gloss: 0.9, edge: 1.12 },
  { id: "mustard", name: "머스터드", color: "#f2c21b", dark: "#a07a06", light: "#fff3a8", width: 14, wobble: 0.3, gloss: 0.55, edge: 1.1 },
  { id: "mayo", name: "마요네즈", color: "#fbf4dc", dark: "#b9a77a", light: "#ffffff", width: 17, wobble: 0.12, gloss: 0.7, edge: 1.22 },
  { id: "sriracha", name: "스리라차", color: "#a81208", dark: "#570803", light: "#e0584a", width: 13, wobble: 0.04, gloss: 0.45, edge: 1.14 },
  { id: "cheese", name: "치즈", color: "#f7a21b", dark: "#a8600a", light: "#ffdc92", width: 23, wobble: 0.18, gloss: 0.8, edge: 1.08 },
  { id: "bbq", name: "바비큐", color: "#4e2410", dark: "#240e04", light: "#a8683c", width: 15, wobble: 0.05, gloss: 0.95, edge: 1.1 },
];

export type Stroke = { sauce: string; pts: [number, number, number][] }; // x,y,widthFactor
export type Grain = { x: number; y: number; r: number; a: number; rot: number };
export type Blob = { x: number; y: number; r: number };
export type SugarBatch = { grains: Grain[]; blobs: Blob[]; t: number };

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// ---------- illustrated assets & layout (logical coords) ----------
export const BOARD_RECT = { x: 150, y: 150, w: 1300, h: 650 };
export const DOG_RECT = { x: 235, y: 300, w: 1150, h: 383 };
const JAR_RECT = { x: 215, y: 0, w: 260, h: 260 };
export const SUGAR_POT = { x: 345, y: 125, r: 120 };
// Fraction of hotdog image width where the batter ends and the stick begins.
const BATTER_END = 0.71;

export type Assets = {
  board: HTMLImageElement;
  dog: HTMLImageElement;
  jar: HTMLImageElement;
  mask: HTMLCanvasElement; // batter-only alpha mask (no stick), logical size
  maskData: Uint8ClampedArray;
};

let assets: Assets | null = null;
export const getAssets = () => assets;

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

export async function loadAssets(src: { board: string; dog: string; jar: string }) {
  if (assets) return assets;
  const [board, dog, jar] = await Promise.all([load(src.board), load(src.dog), load(src.jar)]);
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const m = mask.getContext("2d", { willReadFrequently: true })!;
  m.drawImage(dog, DOG_RECT.x, DOG_RECT.y, DOG_RECT.w, DOG_RECT.h);
  m.globalCompositeOperation = "destination-out";
  m.fillRect(DOG_RECT.x + DOG_RECT.w * BATTER_END, 0, W, H);
  assets = { board, dog, jar, mask, maskData: m.getImageData(0, 0, W, H).data };
  return assets;
}

const inBatter = (x: number, y: number) => {
  if (!assets) return false;
  const xi = x | 0, yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return false;
  return assets.maskData[(yi * W + xi) * 4 + 3]! > 160;
};

export function boardPath() {
  const { x, y, w, h } = BOARD_RECT;
  const p = new Path2D();
  p.roundRect(x + w * 0.015, y + h * 0.025, w * 0.775, h * 0.935, 40);
  p.roundRect(x + w * 0.75, y + h * 0.32, w * 0.235, h * 0.26, 60);
  return { p };
}

export function drawBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#f8f0e0";
  ctx.fillRect(0, 0, W, H);
  if (!assets) return;
  const { x, y, w, h } = BOARD_RECT;
  // soft ground shadow
  ctx.save();
  ctx.fillStyle = "rgba(120,80,40,0.07)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02 + 4, y + h * 0.04 + 8, w * 0.77, h * 0.93, 40);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(assets.board, x, y, w, h);
}

export function drawHotdog(ctx: CanvasRenderingContext2D) {
  if (!assets) return;
  const { x, y, w, h } = DOG_RECT;
  // contact shadow under the hotdog
  ctx.save();
  ctx.fillStyle = "rgba(90,50,15,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.37, y + h * 0.8, w * 0.36, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(90,50,15,0.1)";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.37, y + h * 0.82, w * 0.4, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(assets.dog, x, y, w, h);
}

export function drawSugarPot(ctx: CanvasRenderingContext2D, tiltK: number, hover = false) {
  if (!assets) return;
  const { x, y, w, h } = JAR_RECT;
  ctx.save();
  ctx.fillStyle = "rgba(110,70,30,0.14)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 10, y + h * 0.93, w * 0.3, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  const lift = hover ? -4 : 0;
  ctx.translate(x + w * 0.75, y + h * 0.9);
  ctx.rotate(tiltK * 0.6);
  ctx.drawImage(assets.jar, -w * 0.75, -h * 0.9 + lift, w, h);
  ctx.restore();
  // falling stream toward the hotdog
  if (tiltK > 0.2) {
    const rr = rng(Math.floor(tiltK * 40) + 3);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < 34; i++) {
      const t = rr();
      ctx.fillRect(x + w * 0.85 + t * 110 + rr() * 16, y + h * 0.35 + t * 230 + rr() * 12, 2.6, 2.6);
    }
  }
}

// ---------- sugar ----------
export function makeGrains(count: number, rand: () => number = Math.random): Grain[] {
  const out: Grain[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 60) {
    const x = DOG_RECT.x + rand() * DOG_RECT.w * BATTER_END;
    const y = DOG_RECT.y + rand() * DOG_RECT.h;
    if (!inBatter(x, y)) continue;
    const k = rand();
    const r = k > 0.9 ? 3.4 + rand() * 1.6 : k > 0.55 ? 2.2 + rand() * 1.1 : 1.3 + rand() * 0.9;
    out.push({ x, y, r, a: 0.6 + rand() * 0.35, rot: rand() * Math.PI });
  }
  return out;
}

function makeBlobs(count: number, rand: () => number): Blob[] {
  const out: Blob[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 60) {
    const x = DOG_RECT.x + rand() * DOG_RECT.w * BATTER_END;
    const y = DOG_RECT.y + rand() * DOG_RECT.h;
    if (!inBatter(x, y)) continue;
    out.push({ x, y, r: 50 + rand() * 90 });
  }
  return out;
}

export function makeBatch(): SugarBatch {
  return { grains: makeGrains(240), blobs: makeBlobs(20, Math.random), t: performance.now() };
}

export function initialSugar(): SugarBatch {
  // the illustration already carries a light dusting; add only a few glints
  return { grains: makeGrains(70, rng(42)), blobs: [], t: 0 };
}

let sugarScratch: HTMLCanvasElement | null = null;
export function drawSugar(ctx: CanvasRenderingContext2D, batches: SugarBatch[], now: number) {
  if (!assets) return;
  if (!sugarScratch) { sugarScratch = document.createElement("canvas"); sugarScratch.width = W; sugarScratch.height = H; }
  const c = sugarScratch.getContext("2d")!;
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, W, H);
  const lit = DOG_RECT.y + DOG_RECT.h * 0.42;
  for (const b of batches) {
    const k = b.t ? Math.min(1, (now - b.t) / 450) : 1;
    for (const bl of b.blobs) {
      const rg = c.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r);
      rg.addColorStop(0, `rgba(255,252,246,${0.17 * k})`);
      rg.addColorStop(1, "rgba(255,252,246,0)");
      c.fillStyle = rg;
      c.fillRect(bl.x - bl.r, bl.y - bl.r, bl.r * 2, bl.r * 2);
    }
    const drop = (1 - k) * -70;
    for (const gr of b.grains) {
      const gy = gr.y + drop * (0.6 + (gr.r % 1) * 0.6);
      const s = gr.r;
      c.globalAlpha = 0.3 * k;
      c.fillStyle = "#8a4a14";
      c.fillRect(gr.x - s / 2 + 0.7, gy - s / 2 + 0.9, s, s * 0.85);
      c.globalAlpha = gr.a * k;
      c.fillStyle = "#fffdf7";
      c.fillRect(gr.x - s / 2, gy - s / 2, s, s * 0.85);
      if (s > 3.2 && gr.y < lit && k === 1 && (gr.rot * 10) % 1 < 0.5) {
        c.globalAlpha = 0.85;
        c.fillStyle = "#ffffff";
        c.fillRect(gr.x - s * 0.9, gy - 0.5, s * 1.8, 1);
        c.fillRect(gr.x - 0.5, gy - s * 0.9, 1, s * 1.8);
      }
    }
  }
  c.globalAlpha = 1;
  // keep sugar strictly on the batter
  c.globalCompositeOperation = "destination-in";
  c.drawImage(assets.mask, 0, 0);
  c.globalCompositeOperation = "source-over";
  ctx.drawImage(sugarScratch, 0, 0);
}

// ---------- sauce ----------
// Smooth the raw pointer path (Chaikin) and its width so the line reads as a squeezed bead.
function smooth(pts: [number, number, number][]) {
  let out = pts;
  for (let it = 0; it < 2 && out.length > 2; it++) {
    const n: [number, number, number][] = [out[0]!];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i]!, b = out[i + 1]!;
      n.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25]);
      n.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]);
    }
    n.push(out[out.length - 1]!);
    out = n;
  }
  // width: moving average + gentle taper-in / swell at the ends (blob where squeezing starts)
  const len = out.length;
  return out.map((p, i) => {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - 6); j <= Math.min(len - 1, i + 6); j++) { s += out[j]![2]; c++; }
    const start = Math.min(1, i / 6);
    const endSwell = i > len - 4 ? 1.06 : 1;
    return [p[0], p[1], (s / c) * (0.82 + 0.18 * start) * endSwell] as [number, number, number];
  });
}

function trace(ctx: CanvasRenderingContext2D, pts: [number, number, number][], base: number, mul: number, dx: number, dy: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0]![0] + dx, pts[0]![1] + dy, base * mul * 0.62, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    ctx.lineWidth = base * mul * (a[2] + b[2]) * 0.5;
    ctx.beginPath();
    ctx.moveTo(a[0] + dx, a[1] + dy);
    ctx.lineTo(b[0] + dx, b[1] + dy);
    ctx.stroke();
  }
}

let scratch: HTMLCanvasElement | null = null;
function getScratch(w: number, h: number) {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  const c = scratch.getContext("2d")!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  return c;
}

// Draw all strokes with seamless translucent layers (shadow, gloss) on an offscreen canvas.
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale = 1) {
  if (!strokes.length) return;
  const prepared = strokes.map((s) => ({ s: (SAUCES.find((x) => x.id === s.sauce) ?? SAUCES[0])!, pts: smooth(s.pts) }));
  // bounding box (logical) so offscreen layers stay small and fast
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { s, pts } of prepared) for (const p of pts) {
    const pad = s.width * 1.6 + 12;
    x0 = Math.min(x0, p[0] - pad); y0 = Math.min(y0, p[1] - pad);
    x1 = Math.max(x1, p[0] + pad); y1 = Math.max(y1, p[1] + pad);
  }
  const bw = Math.ceil((x1 - x0) * scale), bh = Math.ceil((y1 - y0) * scale);
  const layer = (fn: (c: CanvasRenderingContext2D) => void, alpha: number, blur: number) => {
    const c = getScratch(bw, bh);
    c.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    fn(c);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    void blur;
    ctx.drawImage(scratch!, 0, 0, bw, bh, x0 * scale, y0 * scale, bw, bh);
    ctx.restore();
  };
  // 1. contact shadow: soft, close — sauce sits ON the surface
  layer((c) => {
    c.fillStyle = c.strokeStyle = "#5a2a08";
    for (const { s, pts } of prepared) trace(c, pts, s.width, 1.22, 1.5, 3.5);
    c.globalCompositeOperation = "destination-out";
    c.globalAlpha = 0.5;
    for (const { s, pts } of prepared) trace(c, pts, s.width, 0.9, 1.5, 3);
  }, 0.3, 0);
  // 2. body: soft rim, then colour (per stroke so order is kept)
  for (const { s, pts } of prepared) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = ctx.strokeStyle = s.dark;
    trace(ctx, pts, s.width, s.edge * 0.98, 0, 0.8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ctx.strokeStyle = s.color;
    trace(ctx, pts, s.width, 0.9, 0, 0);
    ctx.restore();
  }
  // 3. lower inner shade for volume
  layer((c) => {
    for (const { s, pts } of prepared) {
      c.fillStyle = c.strokeStyle = s.dark;
      trace(c, pts, s.width, 0.42, 0, s.width * 0.2);
    }
  }, 0.3, 2.5);
  // 4. gloss: thin soft band offset to the upper-left; strength per sauce
  layer((c) => {
    for (const { s, pts } of prepared) {
      c.globalAlpha = 0.35 + s.gloss * 0.65;
      c.fillStyle = c.strokeStyle = s.light;
      trace(c, pts, s.width, 0.26, -s.width * 0.13, -s.width * 0.17);
    }
  }, 0.75, 1.4);
  ctx.globalAlpha = 1;
}

// Small preview drizzle for sauce buttons, rendered with the real stroke renderer.
export function drawSwatch(canvas: HTMLCanvasElement, sauceId: string) {
  const dpr = 2;
  canvas.width = 56 * dpr;
  canvas.height = 32 * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push([8 + t * 40, 18 - Math.sin(t * Math.PI * 1.6) * 6, 1]);
  }
  const s = SAUCES.find((x) => x.id === sauceId)!;
  const k = 0.55 * (16 / s.width) ** 0.4; // keep thicker sauces visibly thicker
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scaled = { sauce: sauceId, pts };
  const orig = s.width;
  s.width = orig * k;
  drawStrokes(ctx, [scaled], dpr);
  s.width = orig;
}
