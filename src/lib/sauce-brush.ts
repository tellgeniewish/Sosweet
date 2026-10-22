// Food pigments, not UI colors. All distances are in the scene's logical space.
export type Sauce = {
  id: string; name: string; color: string; dark: string; light: string;
  width: number; wobble: number; gloss: number; edge: number;
};
export type Stroke = { sauce: string; pts: [number, number, number][] };
export const SAUCES: Sauce[] = [
  { id: "ketchup", name: "케첩", color: "#dd261b", dark: "#a51b12", light: "#ffe7c3", width: 21, wobble: 0.06, gloss: 0.68, edge: 1 },
  { id: "mustard", name: "머스터드", color: "#f2bc25", dark: "#cb851b", light: "#fff0b4", width: 19, wobble: 0.08, gloss: 0.36, edge: 1.04 },
  { id: "mayo", name: "마요네즈", color: "#f7ebce", dark: "#d3b994", light: "#fff9e9", width: 23, wobble: 0.06, gloss: 0.3, edge: 1.06 },
  { id: "sriracha", name: "스리라차", color: "#e4411c", dark: "#ad2b14", light: "#ffd3a1", width: 19, wobble: 0.06, gloss: 0.5, edge: 1 },
  { id: "cheese", name: "치즈", color: "#f6b528", dark: "#d78c19", light: "#fff1be", width: 25, wobble: 0.08, gloss: 0.34, edge: 1.07 },
  { id: "bbq", name: "바비큐", color: "#693019", dark: "#482012", light: "#dba171", width: 20, wobble: 0.06, gloss: 0.42, edge: 1.02 },
];

// Only consecutive identical sauces may merge: a later red stroke must not
// move underneath an earlier mayonnaise stroke.
export function sauceRuns(strokes: Stroke[]): Stroke[][] {
  const runs: Stroke[][] = [];
  for (const stroke of strokes) {
    if (!stroke.pts.length) continue;
    const last = runs.at(-1);
    if (last?.[0]?.sauce === stroke.sauce) last.push(stroke);
    else runs.push([stroke]);
  }
  return runs;
}

export function prepareSaucePoints(pts: Stroke["pts"]): Stroke["pts"] {
  let out = pts.map(p => [...p] as [number, number, number]);
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const first = out[0];
    const last = out.at(-1);
    if (!first || !last) break;
    const next: Stroke["pts"] = [first];
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1], b = out[i];
      if (!a || !b) continue;
      next.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25, a[2] * .75 + b[2] * .25]);
      next.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75, a[2] * .25 + b[2] * .75]);
    }
    next.push(last);
    out = next;
  }
  let distance = 0;
  return out.map((p, i) => {
    const prev = out[i - 1];
    if (prev) distance += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    // Arc-length variation is stable across redraws and never moves the path.
    const width = 1 + .025 * Math.sin(distance / 29) + .015 * Math.sin(distance / 61);
    const end = i === out.length - 1 ? 1.035 : 1;
    return [p[0], p[1], width * end];
  });
}

function trace(ctx: CanvasRenderingContext2D, pts: Stroke["pts"], width: number, dx = 0, dy = 0) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const first = pts[0];
  if (!first) return;
  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(first[0] + dx, first[1] + dy, width * first[2] / 2, 0, Math.PI * 2); ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (!a || !b) continue;
    ctx.lineWidth = width * (a[2] + b[2]) / 2;
    ctx.beginPath(); ctx.moveTo(a[0] + dx, a[1] + dy); ctx.lineTo(b[0] + dx, b[1] + dy); ctx.stroke();
  }
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
let maskCanvas: HTMLCanvasElement | undefined;
let paintCanvas: HTMLCanvasElement | undefined;

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale = 1) {
  for (const run of sauceRuns(strokes)) {
    const sauce = SAUCES.find(s => s.id === run[0]?.sauce) ?? SAUCES[0];
    if (!sauce) continue;
    const paths = run.map(s => prepareSaucePoints(s.pts));
    const radius = sauce.width * sauce.edge / 2;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const path of paths) for (const [x, y] of path) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    const pad = Math.ceil(radius + 5);
    left = Math.floor(left - pad); top = Math.floor(top - pad);
    const w = Math.ceil(right - left + pad), h = Math.ceil(bottom - top + pad);
    if (!Number.isFinite(w) || w < 1 || h < 1) continue;
    maskCanvas ??= document.createElement("canvas");
    paintCanvas ??= document.createElement("canvas");
    maskCanvas.width = paintCanvas.width = w;
    maskCanvas.height = paintCanvas.height = h;
    const mask = maskCanvas.getContext("2d", { willReadFrequently: true });
    const paint = paintCanvas.getContext("2d");
    if (!mask || !paint) continue;
    mask.translate(-left, -top);
    mask.fillStyle = mask.strokeStyle = sauce.color;
    for (const path of paths) trace(mask, path, radius * 2);
    const pixels = mask.getImageData(0, 0, w, h);
    const distances = new Float32Array(w * h);
    for (let i = 0; i < distances.length; i++) distances[i] = (pixels.data[i * 4 + 3] ?? 0) > 128 ? 1000 : 0;
    // Chamfer distance of the UNION: intersections have one surface, not stacked rims.
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      distances[i] = Math.min(distances[i] ?? 0, (distances[i - 1] ?? 0) + 1, (distances[i - w] ?? 0) + 1, (distances[i - w - 1] ?? 0) + 1.414, (distances[i - w + 1] ?? 0) + 1.414);
    }
    for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) {
      const i = y * w + x;
      distances[i] = Math.min(distances[i] ?? 0, (distances[i + 1] ?? 0) + 1, (distances[i + w] ?? 0) + 1, (distances[i + w + 1] ?? 0) + 1.414, (distances[i + w - 1] ?? 0) + 1.414);
    }
    const base = rgb(sauce.color), dark = rgb(sauce.dark), light = rgb(sauce.light);
    const height = (d: number) => Math.sqrt(Math.max(0, 1 - (1 - Math.min(1, d / radius)) ** 2));
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, p = i * 4;
      if (!pixels.data[p + 3]) continue;
      const d = distances[i] ?? 0;
      const crown = height(d);
      const nx = (height(distances[i + 1] ?? 0) - height(distances[i - 1] ?? 0)) * radius / 2;
      const ny = (height(distances[i + w] ?? 0) - height(distances[i - w] ?? 0)) * radius / 2;
      const facing = (nx + ny) / Math.sqrt(1 + nx * nx + ny * ny);
      const shade = Math.min(.7, .06 + (1 - crown) * .22 + Math.max(0, -facing) * .4);
      const diffuse = Math.max(0, facing) * .25 + crown * .07;
      // Broad quiet upper face plus short cream glints. World coordinates make
      // their phase invariant under cropped redraw, undo, resize and export.
      const patch = Math.max(0, (Math.sin((x + left) * .087 + (y + top) * .053) - .72) / .28);
      const specular = Math.exp(-(((facing - .78) / .22) ** 2)) * patch * sauce.gloss * .85;
      const lit = Math.min(.65, diffuse + specular);
      for (let channel = 0; channel < 3; channel++) {
        const b = base[channel] ?? 0, s = dark[channel] ?? 0, l = light[channel] ?? 255;
        const shaded = b * (1 - shade) + s * shade;
        pixels.data[p + channel] = Math.round(shaded * (1 - lit) + l * lit);
      }
    }
    paint.putImageData(pixels, 0, 0);
    ctx.save();
    // Small warm shadow rendered once per union, never a black outline.
    ctx.scale(scale, scale);
    ctx.fillStyle = ctx.strokeStyle = "#784723";
    ctx.globalAlpha = .08;
    for (const path of paths) trace(ctx, path, radius * 2 + 3, .6, 1.8);
    ctx.globalAlpha = .12;
    for (const path of paths) trace(ctx, path, radius * 2 + 1, .5, 1.2);
    ctx.globalAlpha = 1;
    ctx.drawImage(paintCanvas, left, top);
    ctx.restore();
  }
}