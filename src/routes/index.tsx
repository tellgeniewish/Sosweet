import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  H,
  SAUCES,
  W,
  bodyPath,
  drawBoard,
  drawHotdog,
  drawStroke,
  drawSugar,
  initialSugar,
  makeGrains,
  type Stroke,
  type SugarBatch,
} from "@/lib/hotdog-canvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "소스윗 Sosweet — 핫도그에 소스로 쓰는 한마디" },
      { name: "description", content: "설탕 핫도그 위에 케첩, 머스터드로 직접 글씨를 써보세요." },
      { property: "og:title", content: "소스윗 Sosweet" },
      { property: "og:description", content: "마음은 말로 하기 쑥스러우니까, 핫도그에 써볼까?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const curRef = useRef<Stroke | null>(null);
  const sugarRef = useRef<SugarBatch[]>([]);
  const pathRef = useRef<Path2D | null>(null);
  const rafRef = useRef(0);
  const [sauce, setSauce] = useState(SAUCES[0].id);
  const [strokeCount, setStrokeCount] = useState(0);
  const [sugarLevel, setSugarLevel] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const render = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !baseRef.current) return;
    const ctx = cv.getContext("2d")!;
    const now = performance.now();
    ctx.drawImage(baseRef.current, 0, 0);
    drawSugar(ctx, sugarRef.current, now);
    ctx.save();
    ctx.clip(pathRef.current!);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (curRef.current) drawStroke(ctx, curRef.current);
    ctx.restore();
    const animating = sugarRef.current.some((b) => b.t && now - b.t < 450);
    if (animating) rafRef.current = requestAnimationFrame(render);
  }, []);

  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => {
    const base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    const b = base.getContext("2d")!;
    drawBoard(b);
    drawHotdog(b);
    baseRef.current = base;
    pathRef.current = bodyPath();
    sugarRef.current = [initialSugar()];
    const cv = canvasRef.current!;
    cv.width = W;
    cv.height = H;
    // Fonts may load later — nothing on canvas depends on them.
    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  const toLogical = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const inside = (x: number, y: number) =>
    canvasRef.current!.getContext("2d")!.isPointInPath(pathRef.current!, x, y);

  const onDown = (e: React.PointerEvent) => {
    const [x, y] = toLogical(e);
    if (!inside(x, y)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    curRef.current = { sauce, pts: [[x, y, 1]] };
    schedule();
  };
  const onMove = (e: React.PointerEvent) => {
    const cur = curRef.current;
    if (!cur) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const s = SAUCES.find((x) => x.id === cur.sauce)!;
    const r = canvasRef.current!.getBoundingClientRect();
    for (const ev of events) {
      const x = ((ev.clientX - r.left) / r.width) * W;
      const y = ((ev.clientY - r.top) / r.height) * H;
      const last = cur.pts[cur.pts.length - 1];
      const d = Math.hypot(x - last[0], y - last[1]);
      if (d < 2) continue;
      // interpolate so fast moves stay continuous
      const steps = Math.ceil(d / 6);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const wf = 1 + (Math.random() - 0.5) * s.wobble;
        const prev = cur.pts[cur.pts.length - 1][2];
        cur.pts.push([last[0] + (x - last[0]) * t, last[1] + (y - last[1]) * t, prev * 0.7 + wf * 0.3]);
      }
    }
    schedule();
  };
  const onUp = () => {
    if (!curRef.current) return;
    strokesRef.current.push(curRef.current);
    curRef.current = null;
    setStrokeCount(strokesRef.current.length);
    schedule();
  };

  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    schedule();
  };
  const clearAll = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    schedule();
  };
  const addSugar = () => {
    sugarRef.current.push({ grains: makeGrains(450), t: performance.now() });
    setSugarLevel(sugarRef.current.length - 1);
    schedule();
  };
  const undoSugar = () => {
    if (sugarRef.current.length > 1) sugarRef.current.pop();
    setSugarLevel(sugarRef.current.length - 1);
    schedule();
  };
  const resetSugar = () => {
    sugarRef.current = sugarRef.current.slice(0, 1);
    setSugarLevel(0);
    schedule();
  };
  const finish = () => {
    sugarRef.current.forEach((b) => (b.t = 0));
    render();
    setPreview(canvasRef.current!.toDataURL("image/png"));
  };

  const SugarControls = (
    <div className="flex shrink-0 flex-col gap-2 rounded-2xl bg-card p-3">
      <button className="btn btn-primary" onClick={addSugar} aria-label="설탕 뿌리기">
        <SugarIcon /> 설탕 뿌리기
      </button>
      <div className="flex gap-2">
        <button className="btn flex-1 px-3 text-sm" onClick={undoSugar} disabled={!sugarLevel}>
          설탕 되돌리기
        </button>
        <button className="btn px-3 text-sm" onClick={resetSugar} disabled={!sugarLevel} aria-label="설탕 초기화">
          처음으로
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">추가한 설탕 {sugarLevel}번</p>
    </div>
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-foreground md:py-10">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl text-primary md:text-5xl">소스윗 (Sosweet)</h1>
        <p className="mt-2 font-display text-lg md:text-xl">소스로 쓰는 달콤한 한마디</p>
        <p className="mt-1 text-sm text-muted-foreground">
          마음은 말로 하기 쑥스러우니까, 핫도그에 써볼까?
        </p>
      </header>

      <div className="mx-auto mt-6 grid max-w-[1500px] gap-5 lg:grid-cols-[220px_minmax(0,1fr)_220px] lg:items-center">
        <aside className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          <div
            role="radiogroup"
            aria-label="소스 선택"
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
          >
            {SAUCES.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={sauce === s.id}
                aria-pressed={sauce === s.id}
                onClick={() => setSauce(s.id)}
                className="chip shrink-0"
              >
                <SauceBottle color={s.color} dark={s.dark} />
                <span className="whitespace-nowrap">{s.name}</span>
              </button>
            ))}
          </div>
          {SugarControls}
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <canvas
            ref={canvasRef}
            aria-label="핫도그 드로잉 영역. 핫도그 위를 드래그해서 소스로 글씨를 써보세요."
            className="mx-auto block aspect-[2/1] w-full max-w-[1100px] cursor-crosshair touch-none select-none rounded-3xl"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button className="btn" onClick={undo} disabled={!strokeCount}>
              ↶ 실행 취소
            </button>
            <button className="btn" onClick={clearAll} disabled={!strokeCount}>
              전체 지우기
            </button>
            <button className="btn btn-primary" onClick={finish}>
              완성하기
            </button>
          </div>
        </section>
        <div className="order-3 hidden lg:block" />
      </div>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="완성한 핫도그"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="w-full max-w-3xl rounded-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-center font-display text-2xl">완성! 🌭</h2>
            <img src={preview} alt="완성한 핫도그" className="mt-4 w-full rounded-2xl" />
            <div className="mt-4 flex justify-center gap-3">
              <button className="btn" onClick={() => setPreview(null)}>
                계속 꾸미기
              </button>
              <a className="btn btn-primary" href={preview} download="sosweet-hotdog.png">
                PNG로 저장
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SauceBottle({ color, dark }: { color: string; dark: string }) {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" aria-hidden>
      <path d="M12 1h4l1 6h-6z" fill={dark} />
      <rect x="5" y="7" width="18" height="27" rx="7" fill={color} stroke={dark} strokeWidth="2" />
      <rect x="9" y="12" width="3" height="12" rx="1.5" fill="currentColor" opacity=".18" />
    </svg>
  );
}

function SugarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 9h10l-1 12H8z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      <circle cx="10" cy="3" r=".6" fill="currentColor" />
      <circle cx="14" cy="2" r=".6" fill="currentColor" />
    </svg>
  );
}
