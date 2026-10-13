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

// Hotdog: plump, irregularly bumpy oval, slightly tilted, stick pointing right.
const BODY = { cx: 740, cy: 430, rx: 540, ry: 148, tilt: -0.055 };
const tp = (x: number, y: number): [number, number] => {
  const c = Math.cos(BODY.tilt), s = Math.sin(BODY.tilt);
  return [BODY.cx + x * c - y * s, BODY.cy + x * s + y * c];
};

export function bodyPath() {
  const p = new Path2D();
  const n = 220;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    // superellipse base (fat capsule)
    const e = 0.58;
    const x = Math.sign(ct) * Math.pow(Math.abs(ct), e) * BODY.rx;
    const taper = 1 - 0.07 * Math.max(0, -ct); // left end slightly narrower
    const y = Math.sign(st) * Math.pow(Math.abs(st), 0.82) * BODY.ry * taper;
    // irregular fried-batter bumps: layered sines, stronger near the rim
    const bump =
      1 +
      Math.sin(i * 1.7 + 0.8) * 0.018 +
      Math.sin(i * 3.1) * 0.014 +
      Math.sin(i * 7.7 + 2.1) * 0.011 +
      Math.sin(i * 13.3 + 4.2) * 0.008;
    const [px, py] = tp(x * bump, y * bump);
    i ? p.lineTo(px, py) : p.moveTo(px, py);
  }
  p.closePath();
  return p;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// ---------- sugar ----------
function inBody() {
  const path = bodyPath();
  const c = document.createElement("canvas").getContext("2d")!;
  return (x: number, y: number) => c.isPointInPath(path, x, y);
}

export function makeGrains(count: number, rand: () => number = Math.random): Grain[] {
  const inside = inBody();
  const out: Grain[] = [];
  while (out.length < count) {
    const x = BODY.cx - BODY.rx + rand() * BODY.rx * 2;
    const y = BODY.cy - BODY.ry - 40 + rand() * (BODY.ry * 2 + 80);
    if (!inside(x, y)) continue;
    // mostly fine crystals, a few larger ones
    const k = rand();
    const r = k > 0.9 ? 3.4 + rand() * 1.8 : k > 0.55 ? 2.2 + rand() * 1.2 : 1.2 + rand() * 1;
    out.push({ x, y, r, a: 0.55 + rand() * 0.4, rot: rand() * Math.PI });
  }
  return out;
}

function makeBlobs(count: number, rand: () => number): Blob[] {
  const inside = inBody();
  const out: Blob[] = [];
  while (out.length < count) {
    const x = BODY.cx - BODY.rx + rand() * BODY.rx * 2;
    const y = BODY.cy - BODY.ry + rand() * BODY.ry * 2;
    if (!inside(x, y)) continue;
    out.push({ x, y, r: 40 + rand() * 90 });
  }
  return out;
}

export function makeBatch(): SugarBatch {
  return { grains: makeGrains(260), blobs: makeBlobs(22, Math.random), t: performance.now() };
}

export function initialSugar(): SugarBatch {
  return { grains: makeGrains(190, rng(42)), blobs: [], t: 0 };
}

// Sugar canister: small clickable prop on the upper-left of the board.
export const SUGAR_POT = { x: 205, y: 205, r: 92 };

export function boardPath() {
  // paddle board: wide rounded body on the left, handle on the right, slight tilt
  const p = new Path2D();
  const c = Math.cos(-0.03), s = Math.sin(-0.03);
  const T = (x: number, y: number): [number, number] => [800 + (x - 800) * c - (y - 420) * s, 420 + (x - 800) * s + (y - 420) * c];
  const pts: [number, number][] = [];
  const add = (x: number, y: number) => pts.push(T(x, y));
  const R = 78;
  const bx0 = 70, bx1 = 1360, by0 = 150, by1 = 700;
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 12; i++) { const a = a0 + ((a1 - a0) * i) / 12; add(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
  };
  arc(bx0 + R, by0 + R, Math.PI, Math.PI * 1.5);
  add(bx1 - 40, by0);
  add(bx1, by0 + 60); add(bx1 + 30, 340);
  add(1560, 335); add(1590, 360); add(1590, 470); add(1560, 495);
  add(bx1 + 30, 490); add(bx1, by1 - 70);
  add(bx1 - 40, by1);
  arc(bx0 + R, by1 - R, Math.PI * 0.5, Math.PI);
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return { p, T };
}

export function drawBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#f8f0e0";
  ctx.fillRect(0, 0, W, H);
  const { p, T } = boardPath();
  // soft drop shadow
  ctx.save();
  ctx.translate(6, 16);
  ctx.filter = "blur(10px)";
  ctx.fillStyle = "rgba(120,85,45,0.16)";
  ctx.fill(p);
  ctx.restore();
  // board edge (thickness)
  ctx.save();
  ctx.translate(0, 7);
  ctx.fillStyle = "#c9a06c";
  ctx.fill(p);
  ctx.restore();
  // board face: light oak
  ctx.save();
  ctx.fillStyle = "#e3c391";
  ctx.fill(p);
  ctx.clip(p);
  // subtle radial warmth
  const wg = ctx.createRadialGradient(700, 380, 80, 700, 420, 900);
  wg.addColorStop(0, "rgba(255,240,210,0.5)");
  wg.addColorStop(1, "rgba(170,120,60,0.18)");
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, W, H);
  // fine, natural wood grain
  const r = rng(7);
  ctx.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const y = 120 + i * 6.5 + r() * 4;
    ctx.strokeStyle = `rgba(160,115,60,${0.04 + r() * 0.07})`;
    ctx.lineWidth = 0.7 + r() * 1.4;
    ctx.beginPath();
    for (let x = 40; x <= 1620; x += 50) {
      const [px, py] = T(x, y + Math.sin(x / 230 + i * 0.6) * 4 + Math.sin(x / 67 + i) * 1.5);
      x === 40 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // a few darker grain streaks & knots
  for (let i = 0; i < 7; i++) {
    const y = 180 + r() * 480;
    ctx.strokeStyle = `rgba(140,95,45,${0.08 + r() * 0.06})`;
    ctx.lineWidth = 1.6 + r() * 1.6;
    ctx.beginPath();
    for (let x = 60; x <= 1400; x += 60) {
      const [px, py] = T(x, y + Math.sin(x / 300 + i * 2) * 6);
      x === 60 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  // thin, soft outline
  ctx.strokeStyle = "rgba(150,105,55,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke(p);
}

export function drawSugarPot(ctx: CanvasRenderingContext2D, tiltK: number, hover = false) {
  // White ceramic canister with a "설탕" label. tiltK 0..1 tips it toward the hotdog.
  const { x, y } = SUGAR_POT;
  ctx.save();
  ctx.fillStyle = "rgba(110,70,30,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 58, 52, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  const lift = hover ? -3 : 0;
  ctx.translate(x + 40, y + 56);
  ctx.rotate(tiltK * 0.55);
  ctx.translate(-(x + 40), -(y + 56) + lift);
  // body
  const body = new Path2D();
  body.moveTo(x - 44, y - 22);
  body.bezierCurveTo(x - 46, y + 20, x - 44, y + 50, x - 34, y + 56);
  body.lineTo(x + 34, y + 56);
  body.bezierCurveTo(x + 44, y + 50, x + 46, y + 20, x + 44, y - 22);
  body.closePath();
  ctx.fillStyle = "#fbf8f1";
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // soft watercolor shading on the right side
  const sg = ctx.createLinearGradient(x - 46, 0, x + 46, 0);
  sg.addColorStop(0, "rgba(255,255,255,0.9)");
  sg.addColorStop(0.55, "rgba(240,232,216,0.2)");
  sg.addColorStop(1, "rgba(196,178,148,0.5)");
  ctx.fillStyle = sg;
  ctx.fillRect(x - 50, y - 30, 100, 90);
  // sugar visible through the frosted window at the top
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(x - 50, y - 22, 100, 20);
  const r = rng(5);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(200,188,165,${0.25 + r() * 0.3})`;
    ctx.fillRect(x - 42 + r() * 84, y - 20 + r() * 16, 1.6, 1.6);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(150,120,85,0.55)";
  ctx.lineWidth = 1.6;
  ctx.stroke(body);
  // label
  ctx.fillStyle = "#f3e6cf";
  ctx.beginPath();
  ctx.roundRect(x - 34, y + 8, 68, 34, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(170,120,70,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#7a4a22";
  ctx.font = '600 22px "IBM Plex Sans KR", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("설탕", x, y + 26);
  // wooden lid
  ctx.fillStyle = "#c9a26e";
  ctx.beginPath();
  ctx.roundRect(x - 48, y - 38, 96, 18, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,240,210,0.45)";
  ctx.fillRect(x - 40, y - 34, 70, 3);
  ctx.fillStyle = "#b08654";
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 48, 20, 12, 5);
  ctx.fill();
  // glaze highlight
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 10);
  ctx.quadraticCurveTo(x - 37, y + 25, x - 30, y + 46);
  ctx.stroke();
  ctx.restore();
  // pour stream while tilting
  if (tiltK > 0.25) {
    const rr = rng(Math.floor(tiltK * 50) + 3);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < 26; i++) {
      const t = rr();
      ctx.fillRect(x + 70 + t * 120 + rr() * 14, y + 20 + t * 150 + rr() * 10, 2.4, 2.4);
    }
  }
}

export function drawHotdog(ctx: CanvasRenderingContext2D) {
  // soft ground shadow
  ctx.save();
  ctx.filter = "blur(18px)";
  ctx.fillStyle = "rgba(95,55,20,0.26)";
  const [sx, sy] = tp(10, BODY.ry + 12);
  ctx.beginPath();
  ctx.ellipse(sx, sy, BODY.rx * 0.9, 26, BODY.tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // stick (pale birch, pencil-like)
  const [a0x, a0y] = tp(BODY.rx - 90, 0);
  const [a1x, a1y] = tp(BODY.rx + 250, 0);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c9a874";
  ctx.lineWidth = 30;
  ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(a1x, a1y); ctx.stroke();
  ctx.strokeStyle = "#ecd6ac";
  ctx.lineWidth = 25;
  ctx.beginPath(); ctx.moveTo(a0x, a0y - 1.5); ctx.lineTo(a1x, a1y - 1.5); ctx.stroke();
  ctx.strokeStyle = "rgba(165,125,75,0.35)";
  ctx.lineWidth = 1;
  for (const off of [-5, 2, 7]) {
    ctx.beginPath(); ctx.moveTo(a0x, a0y + off); ctx.lineTo(a1x - 8, a1y + off); ctx.stroke();
  }
  // body
  const p = bodyPath();
  ctx.save();
  ctx.fillStyle = "#dc9440";
  ctx.fill(p);
  ctx.clip(p);
  ctx.save();
  ctx.translate(BODY.cx, BODY.cy);
  ctx.rotate(BODY.tilt);
  const g = ctx.createLinearGradient(0, -BODY.ry, 0, BODY.ry);
  g.addColorStop(0, "rgba(250,200,118,0.8)");
  g.addColorStop(0.45, "rgba(232,160,70,0.15)");
  g.addColorStop(1, "rgba(150,74,20,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(-BODY.rx - 20, -BODY.ry - 20, BODY.rx * 2 + 40, BODY.ry * 2 + 40);
  ctx.restore();
  const r = rng(99);
  // watercolor blooms: uneven, deeper-fried patches and lighter pools
  for (let i = 0; i < 70; i++) {
    const [x, y] = tp((r() * 2 - 1) * BODY.rx * 0.95, (r() * 2 - 1) * BODY.ry * 0.9);
    const rad = 30 + r() * 80;
    const dark = r() > 0.45;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, dark ? `rgba(170,82,20,${0.12 + r() * 0.14})` : `rgba(255,214,140,${0.12 + r() * 0.16})`);
    rg.addColorStop(0.7, dark ? "rgba(170,82,20,0.04)" : "rgba(255,214,140,0.04)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // burnt edge near the stick and at the far left end
  for (const [ex, rad, a] of [[BODY.rx - 50, 110, 0.6], [-BODY.rx + 30, 90, 0.3]] as const) {
    const [jx, jy] = tp(ex, 0);
    const bg = ctx.createRadialGradient(jx, jy, 4, jx, jy, rad);
    bg.addColorStop(0, `rgba(95,40,10,${a})`);
    bg.addColorStop(0.55, `rgba(130,60,16,${a * 0.45})`);
    bg.addColorStop(1, "rgba(130,60,16,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(jx - rad, jy - rad, rad * 2, rad * 2);
  }
  // colored-pencil hatching that follows the form
  ctx.lineCap = "round";
  for (let i = 0; i < 700; i++) {
    const u = r() * 2 - 1, v = r() * 2 - 1;
    const [x, y] = tp(u * BODY.rx, v * BODY.ry);
    const len = 6 + r() * 12;
    const ang = BODY.tilt + 0.9 + v * 0.5 + (r() - 0.5) * 0.3;
    ctx.strokeStyle = v > 0.2 ? `rgba(140,64,16,${0.08 + r() * 0.1})` : `rgba(255,226,170,${0.1 + r() * 0.14})`;
    ctx.lineWidth = 0.8 + r() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  // fine batter crumbs (sparse, low contrast)
  for (let i = 0; i < 900; i++) {
    const [x, y] = tp((r() * 2 - 1) * BODY.rx, (r() * 2 - 1) * BODY.ry);
    ctx.fillStyle = r() > 0.5 ? `rgba(150,70,16,${0.12 + r() * 0.12})` : `rgba(255,220,150,${0.14 + r() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + r() * 2.4, 0.8 + r() * 1.6, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // inner rim shade gives volume without a hard outline
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(140,66,18,0.16)";
  ctx.filter = "blur(6px)";
  ctx.stroke(p);
  ctx.filter = "none";
  ctx.restore();
  ctx.strokeStyle = "rgba(150,76,22,0.35)";
  ctx.lineWidth = 1.4;
  ctx.stroke(p);
}

export function drawSugar(ctx: CanvasRenderingContext2D, batches: SugarBatch[], now: number) {
  const p = bodyPath();
  ctx.save();
  ctx.clip(p);
  for (const b of batches) {
    const k = b.t ? Math.min(1, (now - b.t) / 450) : 1;
    // frosting: soft, uneven white blooms that build up batch by batch
    for (const bl of b.blobs) {
      const rg = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r);
      rg.addColorStop(0, `rgba(255,252,246,${0.16 * k})`);
      rg.addColorStop(1, "rgba(255,252,246,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(bl.x - bl.r, bl.y - bl.r, bl.r * 2, bl.r * 2);
    }
    const drop = (1 - k) * -70;
    for (const gr of b.grains) {
      const gy = gr.y + drop * (0.6 + (gr.r % 1) * 0.6);
      ctx.save();
      ctx.translate(gr.x, gy);
      ctx.rotate(gr.rot);
      const s = gr.r;
      // faint shadow so crystals sit on the batter
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = "#8a4a14";
      ctx.fillRect(-s / 2 + 0.6, -s / 2 + 0.8, s, s * 0.85);
      ctx.globalAlpha = gr.a * k;
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(-s / 2, -s / 2, s, s * 0.85);
      ctx.restore();
      // glints only on the lit upper half, only on bigger crystals
      const [, ly] = [0, (gr.y - BODY.cy) / BODY.ry];
      if (s > 3.2 && ly < -0.15 && k === 1 && (gr.rot * 10) % 1 < 0.5) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(gr.x - s * 0.9, gy - 0.5, s * 1.8, 1);
        ctx.fillRect(gr.x - 0.5, gy - s * 0.9, 1, s * 1.8);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
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
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const prepared = strokes.map((s) => ({ s: (SAUCES.find((x) => x.id === s.sauce) ?? SAUCES[0])!, pts: smooth(s.pts) }));
  const layer = (fn: (c: CanvasRenderingContext2D) => void, alpha: number, blur: number) => {
    const c = getScratch(w, h);
    c.setTransform(scale, 0, 0, scale, 0, 0);
    fn(c);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    if (blur) ctx.filter = `blur(${blur * scale}px)`;
    ctx.drawImage(scratch!, 0, 0);
    ctx.restore();
  };
  // 1. contact shadow: soft, close — sauce sits ON the surface
  layer((c) => {
    c.fillStyle = c.strokeStyle = "#5a2a08";
    for (const { s, pts } of prepared) trace(c, pts, s.width, 1.05, 1.5, 3.5);
  }, 0.32, 3);
  // 2. body: soft rim, then colour (per stroke so order is kept)
  for (const { s, pts } of prepared) {
    ctx.save();
    ctx.filter = `blur(${0.6 * scale}px)`;
    ctx.fillStyle = ctx.strokeStyle = s.dark;
    trace(ctx, pts, s.width, s.edge * 0.98, 0, 0.8);
    ctx.filter = "none";
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
  }, 0.35, 2.5);
  // 4. gloss: a thin soft band offset to the upper-left, strength per sauce
  for (const { s, pts } of prepared) {
    layer((c) => {
      c.fillStyle = c.strokeStyle = s.light;
      trace(c, pts, s.width, 0.26, -s.width * 0.13, -s.width * 0.17);
    }, 0.25 + s.gloss * 0.5, 1.4);
  }
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
