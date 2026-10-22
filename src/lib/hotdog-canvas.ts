// Logical canvas coordinates. All strokes & sugar are stored in this space,
// so resizing the on-screen canvas never shifts them.
export const W = 1600;
export const H = 1050;

export { SAUCES, drawStrokes } from "./sauce-brush";
export type { Sauce, Stroke } from "./sauce-brush";

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
export const BOARD_RECT = { x: 35, y: 340, w: 1530, h: 700 };
export const DOG_RECT = { x: 110, y: 435, w: 1290, h: 460 };
const JAR_RECT = { x: 650, y: 0, w: 350, h: 350 };
export const SUGAR_POT = { x: 825, y: 170, r: 155 };
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
  ctx.clearRect(0, 0, W, H);
  if (!assets) return;
  const { x, y, w, h } = BOARD_RECT;
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

