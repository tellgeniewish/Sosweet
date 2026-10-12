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
export type SugarBatch = { grains: Grain[]; t: number };

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

export function makeGrains(count: number, rand: () => number = Math.random): Grain[] {
  const path = bodyPath();
  const c = document.createElement("canvas").getContext("2d")!;
  const out: Grain[] = [];
  while (out.length < count) {
    const x = BODY.cx - BODY.rx - 10 + rand() * (BODY.rx * 2 + 20);
    const y = BODY.cy - BODY.ry - 50 + rand() * (BODY.ry * 2 + 100);
    if (!c.isPointInPath(path, x, y)) continue;
    out.push({ x, y, r: 1.6 + rand() * 3.6, a: 0.6 + rand() * 0.4, rot: rand() * Math.PI });
  }
  return out;
}

export function initialSugar(): SugarBatch {
  return { grains: makeGrains(900, rng(42)), t: 0 };
}

// Sugar pot: small clickable prop sitting on the upper-left of the board.
export const SUGAR_POT = { x: 215, y: 218, r: 62 };

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

export function drawSugarPot(ctx: CanvasRenderingContext2D, tiltK: number) {
  // tiltK 0..1: pot tips over to pour
  const { x, y } = SUGAR_POT;
  ctx.save();
  // shadow
  ctx.fillStyle = "rgba(110,70,30,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 46, 46, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y + 40);
  ctx.rotate(-tiltK * 0.5);
  ctx.translate(-x, -(y + 40));
  // glass jar
  const jar = new Path2D();
  jar.moveTo(x - 34, y - 10);
  jar.bezierCurveTo(x - 38, y + 22, x - 30, y + 42, x, y + 44);
  jar.bezierCurveTo(x + 30, y + 42, x + 38, y + 22, x + 34, y - 10);
  jar.closePath();
  ctx.fillStyle = "rgba(255,253,248,0.9)";
  ctx.fill(jar);
  // sugar fill inside
  ctx.save();
  ctx.clip(jar);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 40, y + 6, 80, 44);
  ctx.fillStyle = "rgba(230,220,200,0.6)";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(150,120,80,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke(jar);
  // metal lid
  ctx.fillStyle = "#c8b394";
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a98f6c";
  ctx.fillRect(x - 36, y - 14, 72, 6);
  ctx.beginPath();
  ctx.ellipse(x, y - 16, 36, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#d9c4a2";
  ctx.fill();
  // lid holes
  ctx.fillStyle = "rgba(90,65,35,0.7)";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 12, y - 17, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // glass highlight
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x - 6, y + 16, 26, Math.PI * 0.75, Math.PI * 1.15);
  ctx.stroke();
  ctx.restore();
}

export function drawHotdog(ctx: CanvasRenderingContext2D) {
  // soft ground shadow
  ctx.save();
  ctx.filter = "blur(16px)";
  ctx.fillStyle = "rgba(95,55,20,0.3)";
  const [sx, sy] = tp(10, BODY.ry + 14);
  ctx.beginPath();
  ctx.ellipse(sx, sy, BODY.rx * 0.92, 30, BODY.tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // stick
  const [a0x, a0y] = tp(BODY.rx - 90, 0);
  const [a1x, a1y] = tp(BODY.rx + 250, 0);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#b08a58";
  ctx.lineWidth = 32;
  ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(a1x, a1y); ctx.stroke();
  ctx.strokeStyle = "#eed6a8";
  ctx.lineWidth = 26;
  ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.lineTo(a1x, a1y); ctx.stroke();
  // wood grain on stick
  ctx.strokeStyle = "rgba(160,120,70,0.5)";
  ctx.lineWidth = 1.4;
  for (const off of [-6, 0, 6]) {
    ctx.beginPath(); ctx.moveTo(a0x, a0y + off); ctx.lineTo(a1x - 4, a1y + off); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,246,224,0.85)";
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(a0x, a0y - 8); ctx.lineTo(a1x - 6, a1y - 8); ctx.stroke();
  // body
  const p = bodyPath();
  ctx.save();
  ctx.fillStyle = "#d98a2b";
  ctx.fill(p);
  ctx.clip(p);
  ctx.save();
  ctx.translate(BODY.cx, BODY.cy);
  ctx.rotate(BODY.tilt);
  // warm golden-to-baked-brown vertical gradient
  const g = ctx.createLinearGradient(0, -BODY.ry, 0, BODY.ry);
  g.addColorStop(0, "rgba(252,196,105,0.85)");
  g.addColorStop(0.35, "rgba(238,158,58,0.25)");
  g.addColorStop(0.75, "rgba(178,94,22,0.45)");
  g.addColorStop(1, "rgba(122,58,12,0.6)");
  ctx.fillStyle = g;
  ctx.fillRect(-BODY.rx - 20, -BODY.ry - 20, BODY.rx * 2 + 40, BODY.ry * 2 + 40);
  // top-left sheen
  const rg = ctx.createRadialGradient(-BODY.rx * 0.25, -BODY.ry * 0.4, 10, -BODY.rx * 0.1, -BODY.ry * 0.1, BODY.rx);
  rg.addColorStop(0, "rgba(255,232,165,0.5)");
  rg.addColorStop(1, "rgba(255,232,165,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(-BODY.rx - 20, -BODY.ry - 20, BODY.rx * 2 + 40, BODY.ry * 2 + 40);
  ctx.restore();
  // burnt spot where the stick enters
  const [jx, jy] = tp(BODY.rx - 60, 0);
  const bg = ctx.createRadialGradient(jx, jy, 4, jx, jy, 90);
  bg.addColorStop(0, "rgba(70,30,8,0.75)");
  bg.addColorStop(0.5, "rgba(110,52,14,0.4)");
  bg.addColorStop(1, "rgba(110,52,14,0)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(jx, jy, 90, 0, Math.PI * 2);
  ctx.fill();
  // panko crumb texture: varied sizes, warm highlights and toasted flecks
  const r = rng(99);
  for (let i = 0; i < 3200; i++) {
    const x = BODY.cx - BODY.rx + r() * BODY.rx * 2;
    const y = BODY.cy - BODY.ry - 40 + r() * (BODY.ry * 2 + 80);
    const k = r();
    ctx.fillStyle =
      k > 0.62 ? `rgba(168,84,18,${0.2 + r() * 0.18})`
      : k > 0.3 ? `rgba(255,208,120,${0.28 + r() * 0.2})`
      : `rgba(118,52,10,${0.22 + r() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2 + r() * 5, 0.9 + r() * 3.2, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // larger crispy flakes
  for (let i = 0; i < 260; i++) {
    const x = BODY.cx - BODY.rx + r() * BODY.rx * 2;
    const y = BODY.cy - BODY.ry + r() * BODY.ry * 2;
    ctx.fillStyle = r() > 0.5 ? "rgba(255,222,150,0.5)" : "rgba(150,72,16,0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + r() * 5, 1.6 + r() * 2.6, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // crumbly, irregular rim
  ctx.strokeStyle = "rgba(158,80,20,0.65)";
  ctx.lineWidth = 2.4;
  ctx.setLineDash([7, 4, 2, 5, 4, 3]);
  ctx.stroke(p);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,214,140,0.4)";
  ctx.lineWidth = 1.4;
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
      // tiny sparkle on bigger crystals
      if (gr.r > 3.6) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(-gr.r, -0.6, gr.r * 2, 1.2);
        ctx.fillRect(-0.6, -gr.r, 1.2, gr.r * 2);
      }
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
  pass("rgba(60,25,5,0.26)", 1.12, 2, 5); // drop shadow
  pass(sauce.dark, sauce.edge, 0, 0); // outline (keeps mayo visible)
  pass(sauce.color, 1, 0, 0);
  pass(sauce.light, 0.3, -sauce.width * 0.18, -sauce.width * 0.2, 0.35 + sauce.gloss * 0.5); // gloss
  ctx.globalAlpha = 1;
}
