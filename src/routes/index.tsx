import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  H,
  SAUCES,
  SUGAR_POT,
  W,
  boardPath,
  drawBoard,
  drawHotdog,
  drawStrokes,
  drawSwatch,
  makeBatch,
  drawSugar,
  drawSugarPot,
  initialSugar,
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
  const boardRef = useRef<Path2D | null>(null);
  const rafRef = useRef(0);
  const potAnimRef = useRef(0); // timestamp of last pot click, 0 = idle
  const hoverRef = useRef(false);
  const [sauce, setSauce] = useState(SAUCES[0]!.id);
  const [strokeCount, setStrokeCount] = useState(0);
  const [sugarLevel, setSugarLevel] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const render = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !baseRef.current) return;
    const ctx = cv.getContext("2d")!;
    const now = performance.now();
    ctx.drawImage(baseRef.current, 0, 0);
    // sugar pot tilt animation (400ms)
    const potT = potAnimRef.current ? Math.min(1, (now - potAnimRef.current) / 400) : 0;
    const tiltK = potT > 0 ? Math.sin(potT * Math.PI) : 0;
    if (potT >= 1) potAnimRef.current = 0;
    drawSugarPot(ctx, tiltK, hoverRef.current);
    drawSugar(ctx, sugarRef.current, now);
    ctx.save();
    ctx.clip(boardRef.current!);
    drawStrokes(ctx, curRef.current ? [...strokesRef.current, curRef.current] : strokesRef.current);
    ctx.restore();
    const animating =
      sugarRef.current.some((b) => b.t && now - b.t < 450) || potT > 0;
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
    boardRef.current = boardPath().p;
    sugarRef.current = [initialSugar()];
    const cv = canvasRef.current!;
    cv.width = W;
    cv.height = H;
    render();
    document.fonts?.ready.then(() => render());
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  const toLogical = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const insideBoard = (x: number, y: number) =>
    canvasRef.current!.getContext("2d")!.isPointInPath(boardRef.current!, x, y);
  const insidePot = (x: number, y: number) =>
    Math.hypot(x - SUGAR_POT.x, y - SUGAR_POT.y) < SUGAR_POT.r;

  const addSugar = useCallback(() => {
    sugarRef.current.push(makeBatch());
    setSugarLevel(sugarRef.current.length - 1);
    potAnimRef.current = performance.now();
    schedule();
  }, [schedule]);

  const onDown = (e: React.PointerEvent) => {
    const [x, y] = toLogical(e);
    if (insidePot(x, y)) {
      addSugar();
      return;
    }
    if (!insideBoard(x, y)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    curRef.current = { sauce, pts: [[x, y, 1]] };
    schedule();
  };
  const onMove = (e: React.PointerEvent) => {
    const cur = curRef.current;
    if (!cur) {
      const [hx, hy] = toLogical(e);
      const over = insidePot(hx, hy);
      e.currentTarget.style.cursor = over ? "pointer" : insideBoard(hx, hy) ? "crosshair" : "default";
      if (over !== hoverRef.current) { hoverRef.current = over; schedule(); }
      return;
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const s = SAUCES.find((x) => x.id === cur.sauce)!;
    const r = canvasRef.current!.getBoundingClientRect();
    for (const ev of events) {
      const x = ((ev.clientX - r.left) / r.width) * W;
      const y = ((ev.clientY - r.top) / r.height) * H;
      const last = cur.pts[cur.pts.length - 1]!;
      const d = Math.hypot(x - last[0], y - last[1]);
      if (d < 2) continue;
      // interpolate so fast moves stay continuous
      const steps = Math.ceil(d / 6);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const wf = 1 + (Math.random() - 0.5) * s.wobble * 0.5;
        const prev = cur.pts[cur.pts.length - 1]![2];
        cur.pts.push([last[0] + (x - last[0]) * t, last[1] + (y - last[1]) * t, prev * 0.85 + wf * 0.15]);
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
    potAnimRef.current = 0;
    render();
    setPreview(canvasRef.current!.toDataURL("image/png"));
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-foreground md:py-8">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl tracking-tight text-primary md:text-[2.5rem]">소스윗 (Sosweet)</h1>
        <p className="mt-2 text-base font-medium md:text-lg">소스로 쓰는 달콤한 한마디</p>
        <p className="mt-1 text-xs text-muted-foreground md:text-sm">
          마음은 말로 하기 쑥스러우니까, 핫도그에 써볼까?
        </p>
      </header>

      <div className="mx-auto mt-5 grid max-w-[1500px] gap-4 lg:grid-cols-[200px_minmax(0,1fr)_200px] lg:items-center">
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
                <SauceSwatch id={s.id} />
                <span className="whitespace-nowrap">{s.name}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 lg:flex-col">
            <button className="btn flex-1 px-3 text-sm" onClick={undoSugar} disabled={!sugarLevel}>
              설탕 되돌리기
            </button>
            <button className="btn flex-1 px-3 text-sm" onClick={resetSugar} disabled={!sugarLevel} aria-label="설탕 초기화">
              설탕 처음으로
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground lg:text-left">
            설탕은 도마 위 ‘설탕’ 통을 눌러 뿌려요. (추가 {sugarLevel}번)
          </p>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <canvas
            ref={canvasRef}
            aria-label="핫도그 드로잉 영역. 핫도그나 도마 위를 드래그해서 소스로 글씨를 써보세요."
            className="mx-auto block aspect-[2/1] w-full max-w-[1100px] cursor-crosshair touch-none select-none rounded-3xl"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <div className="mt-4 flex flex-wrap justify-center gap-3">
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
            <h2 className="text-center font-display text-2xl tracking-tight">완성! 🌭</h2>
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

// Sauce sample rendered with the same renderer used on the hotdog.
function SauceSwatch({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawSwatch(ref.current, id);
  }, [id]);
  return <canvas ref={ref} aria-hidden style={{ width: 56, height: 32 }} />;
}
