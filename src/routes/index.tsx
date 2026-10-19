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
  makeBatch,
  drawSugar,
  drawSugarPot,
  initialSugar,
  type Stroke,
  type SugarBatch,
  loadAssets,
} from "@/lib/hotdog-canvas";
import boardImg from "@/assets/board.png";
import dogImg from "@/assets/hotdog.png";
import jarImg from "@/assets/sugar-jar.png";
import tabletopImg from "@/assets/tabletop.jpg";
import woodTextureImg from "@/assets/wood-texture.jpg";
import ketchupImg from "@/assets/sauce-ketchup.png";
import mustardImg from "@/assets/sauce-mustard.png";
import mayoImg from "@/assets/sauce-mayo.png";
import srirachaImg from "@/assets/sauce-sriracha.png";
import cheeseImg from "@/assets/sauce-cheese.png";
import bbqImg from "@/assets/sauce-bbq.png";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, Undo2 } from "lucide-react";

const sauceImages = [ketchupImg, mustardImg, mayoImg, srirachaImg, cheeseImg, bbqImg];

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
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const rebuildInk = useCallback(() => {
    const ink = inkRef.current;
    if (!ink) return;
    const c = ink.getContext("2d")!;
    c.clearRect(0, 0, W, H);
    c.save();
    c.clip(boardRef.current!);
    drawStrokes(c, strokesRef.current);
    c.restore();
  }, []);
  const [sauce, setSauce] = useState(SAUCES[0]!.id);
  const [strokeCount, setStrokeCount] = useState(0);
  const [sugarLevel, setSugarLevel] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const render = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !baseRef.current) return;
    const ctx = cv.getContext("2d")!;
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(baseRef.current, 0, 0);
    // sugar pot tilt animation (400ms)
    const potT = potAnimRef.current ? Math.min(1, (now - potAnimRef.current) / 400) : 0;
    const tiltK = potT > 0 ? Math.sin(potT * Math.PI) : 0;
    if (potT >= 1) potAnimRef.current = 0;
    drawSugarPot(ctx, tiltK, hoverRef.current);
    drawSugar(ctx, sugarRef.current, now);
    ctx.save();
    ctx.clip(boardRef.current!);
    if (inkRef.current) ctx.drawImage(inkRef.current, 0, 0);
    if (curRef.current) drawStrokes(ctx, [curRef.current]);
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
    let alive = true;
    loadAssets({ board: boardImg, dog: dogImg, jar: jarImg }).then(() => {
    if (!alive) return;
    const base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    const b = base.getContext("2d")!;
    drawBoard(b);
    drawHotdog(b);
    baseRef.current = base;
    const ink = document.createElement("canvas");
    ink.width = W;
    ink.height = H;
    inkRef.current = ink;
    boardRef.current = boardPath().p;
    sugarRef.current = [initialSugar()];
    const cv = canvasRef.current!;
    cv.width = W;
    cv.height = H;
    render();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  const toLogical = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const insideBoard = (x: number, y: number) => !!boardRef.current &&
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
      canvasRef.current!.style.cursor = over ? "pointer" : insideBoard(hx, hy) ? "crosshair" : "default";
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
    rebuildInk();
    setStrokeCount(strokesRef.current.length);
    schedule();
  };

  const undo = () => {
    strokesRef.current.pop();
    rebuildInk();
    setStrokeCount(strokesRef.current.length);
    schedule();
  };
  const clearAll = () => {
    strokesRef.current = [];
    rebuildInk();
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
    <main className="sosweet-table min-h-screen overflow-x-hidden text-foreground" style={{ backgroundImage: `url(${tabletopImg}), url(${woodTextureImg})` }}>
      <header className="sosweet-heading mx-auto text-center">
        <h1 className="font-display text-2xl font-bold md:text-3xl">소스윗 <span className="text-sm font-normal">Sosweet</span></h1>
        <p className="mt-1 text-sm">소스로 쓰는 달콤한 한마디</p>
      </header>

      <div className="sosweet-workspace mx-auto grid max-w-[1500px]">
        <aside className="sauce-panel min-w-0">
          <div
            role="radiogroup"
            aria-label="소스 선택"
            className="sauce-list"
          >
            {SAUCES.map((s, i) => (
              <Button
                variant="ghost"
                key={s.id}
                role="radio"
                aria-checked={sauce === s.id}
                onClick={() => setSauce(s.id)}
                className="sauce-choice"
              >
                <img src={sauceImages[i]} alt="" className="sauce-pair" />
                <span>{s.name}</span>
                <span className="sauce-check" aria-hidden="true">{sauce === s.id && <Check />}</span>
              </Button>
            ))}
          </div>
          <div className="sugar-actions flex justify-center gap-2">
            <Button variant="ghost" className="text-xs" onClick={undoSugar} disabled={!sugarLevel}>
              설탕 되돌리기
            </Button>
            <Button variant="ghost" className="text-xs" onClick={resetSugar} disabled={!sugarLevel} aria-label="설탕 초기화">
              설탕 처음으로
            </Button>
          </div>
          <output className="sr-only" aria-live="polite">설탕 추가 {sugarLevel}번</output>
        </aside>

        <section className="drawing-scene min-w-0">
          <canvas
            ref={canvasRef}
            aria-label="핫도그 드로잉 영역. 핫도그나 도마 위를 드래그해서 소스로 글씨를 써보세요."
            className="mx-auto block aspect-[32/21] w-full cursor-crosshair touch-none select-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </section>
        <div className="scene-actions flex flex-wrap justify-center gap-3">
          <Button variant="outline" className="scene-button" onClick={undo} disabled={!strokeCount} aria-label="실행 취소"><Undo2 /> 실행 취소</Button>
          <Button variant="outline" className="scene-button" onClick={clearAll} disabled={!strokeCount}><RotateCcw /> 다시하기</Button>
          <Button className="scene-button" onClick={finish}><Check /> 완성하기</Button>
        </div>
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
              <Button variant="outline" onClick={() => setPreview(null)}>
                계속 꾸미기
              </Button>
              <Button asChild><a href={preview} download="sosweet-hotdog.png">PNG로 저장</a></Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

