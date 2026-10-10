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

// Hotdog: plump oval, slightly tilted, stick pointing right.
const BODY = { cx: 720, cy: 410, rx: 560, ry: 150, tilt: -0.06 };
const tp = (x: number, y: number): [number, number] => {
  const c = Math.cos(BODY.tilt), s = Math.sin(BODY.tilt);
  return [BODY.cx + x * c - y * s, BODY.cy + x * s + y * c];
};

export function bodyPath() {
  const p = new Path2D();
  const n = 160;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    // superellipse (fat capsule) + small crumb bumps
    const e = 0.55;
    const x = Math.sign(ct) * Math.pow(Math.abs(ct), e) * BODY.rx;
    const taper = 1 - 0.06 * Math.max(0, -ct); // left end slightly narrower
    const bump = 1 + Math.sin(i * 2.9) * 0.008 + Math.sin(i * 7.3) * 0.006;
    const y = Math.sign(st) * Math.pow(Math.abs(st), 0.8) * BODY.ry * taper;
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

export function makeGrains(count: number, rand: () => number = Math.random): Grain[] {
  const path = bodyPath();
  const c = document.createElement("canvas").getContext("2d")!;
  const out: Grain[] = [];
  while (out.length < count) {
    const x = BODY.cx - BODY.rx - 10 + rand() * (BODY.rx * 2 + 20);
    const y = BODY.cy - BODY.ry - 50 + rand() * (BODY.ry * 2 + 100);
    if (!c.isPointInPath(path, x, y)) continue;
    out.push({ x, y, r: 2 + rand() * 3.4, a: 0.65 + rand() * 0.35, rot: rand() * Math.PI });
  }
  return out;
}

export function initialSugar(): SugarBatch {
  return { grains: makeGrains(900, rng(42)), t: 0 };
}

function boardPath() {
  // paddle board: wide rounded body on the left, handle on the right, slight tilt
  const p = new Path2D();
  const c = Math.cos(-0.035), s = Math.sin(-0.035);
  const T = (x: number, y: number): [number, number] => [800 + (x - 800) * c - (y - 420) * s, 420 + (x - 800) * s + (y - 420) * c];
  const pts: [number, number][] = [];
  const add = (x: number, y: number) => pts.push(T(x, y));
  const R = 70;
  // body corners
  const bx0 = 70, bx1 = 1360, by0 = 150, by1 = 700;
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 10; i++) { const a = a0 + ((a1 - a0) * i) / 10; add(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
  };
  arc(bx0 + R, by0 + R, Math.PI, Math.PI * 1.5);
  add(bx1 - 40, by0);
  // shoulder into handle
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
  ctx.fillStyle = "#f6ecd8";
  ctx.fillRect(0, 0, W, H);
  const { p, T } = boardPath();
  // thickness / shadow
  ctx.save();
  ctx.translate(8, 18);
  ctx.fillStyle = "rgba(120,80,40,0.14)";
  ctx.fill(p);
  ctx.translate(-4, -8);
  ctx.fillStyle = "#b07a45";
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "#dcae78";
  ctx.fill(p);
  ctx.clip(p);
  const r = rng(7);
  ctx.lineCap = "round";
  for (let i = 0; i < 40; i++) {
    const y = 130 + i * 15 + r() * 8;
    ctx.strokeStyle = `rgba(150,95,50,${0.06 + r() * 0.1})`;
    ctx.lineWidth = 1.2 + r() * 2.2;
    ctx.beginPath();
    for (let x = 40; x <= 1620; x += 60) {
      const [px, py] = T(x, y + Math.sin(x / 170 + i * 0.7) * 5);
      x === 40 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#b9844f";
  ctx.lineWidth = 4;
  ctx.stroke(p);
}

export function drawHotdog(ctx: CanvasRenderingContext2D) {
  // soft shadow
  ctx.save();
  ctx.filter = "blur(14px)";
  ctx.fillStyle = "rgba(90,45,15,0.32)";
  const [sx, sy] = tp(20, BODY.ry + 10);
  ctx.beginPath();
  ctx.ellipse(sx, sy, BODY.rx * 0.95, 30, BODY.tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // stick
  const [a0x, a0y] = tp(BODY.rx - 80, 0);
  const [a1x, a1y] = tp(BODY.rx + 250, 0);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#a9814f";
  ctx.lineWidth = 34;
  ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(a1x, a1y); ctx.stroke();
  ctx.strokeStyle = "#ecd3a2";
  ctx.lineWidth = 28;
  ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(a1x, a1y); ctx.stroke();
  ctx.strokeStyle = "rgba(255,245,220,0.8)";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(a0x, a0y - 7); ctx.lineTo(a1x - 6, a1y - 7); ctx.stroke();
  // body
  const p = bodyPath();
  ctx.save();
  ctx.fillStyle = "#d4741a";
  ctx.fill(p);
  ctx.clip(p);
  ctx.save();
  ctx.translate(BODY.cx, BODY.cy);
  ctx.rotate(BODY.tilt);
  const g = ctx.createLinearGradient(0, -BODY.ry, 0, BODY.ry);
  g.addColorStop(0, "rgba(250,180,80,0.75)");
  g.addColorStop(0.4, "rgba(230,140,40,0.1)");
  g.addColorStop(1, "rgba(140,60,10,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(-BODY.rx - 20, -BODY.ry - 20, BODY.rx * 2 + 40, BODY.ry * 2 + 40);
  const rg = ctx.createRadialGradient(-BODY.rx * 0.2, -BODY.ry * 0.35, 10, 0, 0, BODY.rx);
  rg.addColorStop(0, "rgba(255,225,150,0.45)");
  rg.addColorStop(1, "rgba(255,225,150,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(-BODY.rx - 20, -BODY.ry - 20, BODY.rx * 2 + 40, BODY.ry * 2 + 40);
  ctx.restore();
  // crumb (panko) texture
  const r = rng(99);
  for (let i = 0; i < 2600; i++) {
    const x = BODY.cx - BODY.rx + r() * BODY.rx * 2;
    const y = BODY.cy - BODY.ry - 40 + r() * (BODY.ry * 2 + 80);
    const k = r();
    ctx.fillStyle = k > 0.55 ? "rgba(160,75,15,0.28)" : k > 0.2 ? "rgba(255,200,110,0.4)" : "rgba(120,50,10,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y, 1.5 + r() * 4.5, 1 + r() * 3, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // crumbly rim
  ctx.strokeStyle = "rgba(170,85,20,0.75)";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 3, 2, 4]);
  ctx.stroke(p);
  ctx.setLineDash([]);
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
  const sauce = (SAUCES.find((x) => x.id === s.sauce) ?? SAUCES[0])!;
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
      ctx.arc(pts[0]![0] + dx, pts[0]![1] + dy, (sauce.width * wMul) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
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
