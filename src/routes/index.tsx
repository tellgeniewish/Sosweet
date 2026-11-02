import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  H,
  SAUCES,
  SUGAR_POT,
  W,
  boardPath,
  drawBoard,
  makeBatch,
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
import { Check, RotateCcw, Undo2, Volume2, VolumeX, Scissors, Combine } from "lucide-react";
import { FoodSound } from '@/lib/food-sound';
import { FoodScene } from '@/lib/food-scene';
import { cutProgress, TYPE_DURATION, type Surface } from '@/lib/food-geometry';

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
  const strokesRef = useRef<Stroke[]>([]);
  const curRef = useRef<Stroke | null>(null);
  const sugarRef = useRef<SugarBatch[]>([]);
  const boardRef = useRef<Path2D | null>(null);
  const rafRef = useRef(0);
  const potAnimRef = useRef(0); // timestamp of last pot click, 0 = idle
  const hoverRef = useRef(false);
  const sceneRef = useRef<FoodScene | null>(null);
  const soundRef = useRef<FoodSound | null>(null);
  const openRef = useRef(0);
  const mixRef = useRef(0);
  const transitionRef = useRef<{ kind: 'cut' | 'join' | 'type'; start: number; from: number; to: number } | null>(null);
  const dirtyRef = useRef(true);
  const gestureRef = useRef(0);
  const activePointerRef = useRef<number | null>(null);
  const surfaceRef = useRef<Surface>('auto');
  const [sauce, setSauce] = useState('ketchup');
  const [strokeCount, setStrokeCount] = useState(0);
  const [sugarLevel, setSugarLevel] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [potato, setPotato] = useState(false);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const rebuildInk = useCallback(() => { dirtyRef.current = true; }, []);

  const render = useCallback(() => {
    const cv = canvasRef.current, scene = sceneRef.current;
    const ctx = cv?.getContext('2d');
    if (!ctx || !scene || !boardRef.current) return;
    const now = performance.now();
    const transition = transitionRef.current;
    let knife: number | null = null;
    if (transition) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let done = false;
      if (transition.kind === 'type') {
        const t = Math.min(1, (now - transition.start) / (reduced ? 1 : TYPE_DURATION));
        mixRef.current = transition.from + (transition.to - transition.from) * t * t * (3 - 2 * t);
        dirtyRef.current = true; done = t === 1;
      } else {
        const progress = cutProgress(now - transition.start, transition.kind === 'join', reduced);
        openRef.current = progress.open;
        if (transition.kind === 'cut') knife = progress.knife;
        done = progress.done;
      }
      if (done) { transitionRef.current = null; setBusy(false); knife = null; }
    }
    const sugarAnimating = sugarRef.current.some(b => b.t && now - b.t < 450);
    if (dirtyRef.current || curRef.current || sugarAnimating) {
      scene.rebuild(curRef.current ? [...strokesRef.current, curRef.current] : strokesRef.current, sugarRef.current, now, mixRef.current, boardRef.current);
      dirtyRef.current = false;
    }
    drawBoard(ctx);
    const potT = potAnimRef.current ? Math.min(1, (now - potAnimRef.current) / 400) : 0;
    drawSugarPot(ctx, potT > 0 ? Math.sin(potT * Math.PI) : 0, hoverRef.current);
    if (potT >= 1) potAnimRef.current = 0;
    scene.draw(ctx, openRef.current, knife);
    if (transitionRef.current || sugarAnimating || potAnimRef.current) rafRef.current = requestAnimationFrame(render);
  }, []);

  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => {
    let alive = true;
    const sound = new FoodSound();
    soundRef.current = sound;
    try {
      const enabled = localStorage.getItem('sosweet-sound') !== 'off';
      sound.mute(enabled); setSoundEnabled(enabled);
    } catch { /* Preferences are optional when storage is unavailable. */ }
    const stop = () => { onUp(); sound.stop(undefined, true); };
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', stop);
    loadAssets({ board: boardImg, dog: dogImg, jar: jarImg }).then(() => {
      if (!alive || !canvasRef.current) return;
      boardRef.current = boardPath().p;
      sugarRef.current = [initialSugar()];
      canvasRef.current.width = W; canvasRef.current.height = H;
      sceneRef.current = new FoodScene();
      setReady(true); render();
    });
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', stop);
      sound.dispose();
      cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  const toLogical = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] : [0, 0];
  };
  const insideBoard = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d'), path = boardRef.current;
    return !!ctx && !!path && ctx.isPointInPath(path, x, y);
  };
  const insidePot = (x: number, y: number) => Math.hypot(x - SUGAR_POT.x, y - SUGAR_POT.y) < SUGAR_POT.r;
  const addSugar = useCallback(() => {
    if (transitionRef.current || !sceneRef.current) return;
    sugarRef.current.push(makeBatch());
    setSugarLevel(sugarRef.current.length - 1);
    potAnimRef.current = performance.now();
    dirtyRef.current = true;
    void soundRef.current?.gesture('sugar'); schedule();
  }, [schedule]);

  const onDown = (e: React.PointerEvent) => {
    if (transitionRef.current || !sceneRef.current || curRef.current || !e.isPrimary || e.button !== 0) return;
    const [x, y] = toLogical(e);
    if (insidePot(x, y)) { addSugar(); return; }
    if (!insideBoard(x, y)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerRef.current = e.pointerId;
    gestureRef.current++;
    const hit = openRef.current ? sceneRef.current.hit(x, y, openRef.current, mixRef.current >= .5) : { x, y, surface: 'auto' as const };
    surfaceRef.current = hit.surface;
    curRef.current = { sauce, pts: [[hit.x, hit.y, 1]], surface: hit.surface, gesture: gestureRef.current };
    schedule();
  };
  const onMove = (e: React.PointerEvent) => {
    if (transitionRef.current || (activePointerRef.current !== null && activePointerRef.current !== e.pointerId)) return;
    const cv = canvasRef.current;
    if (!cv) return;
    if (!curRef.current) {
      const [x, y] = toLogical(e), over = insidePot(x, y);
      cv.style.cursor = over ? 'pointer' : insideBoard(x, y) ? 'crosshair' : 'default';
      if (over !== hoverRef.current) { hoverRef.current = over; schedule(); }
      return;
    }
    const r = cv.getBoundingClientRect();
    const events = e.nativeEvent.getCoalescedEvents?.();
    let added = false;
    for (const ev of events?.length ? events : [e.nativeEvent]) {
      const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
      let cur: Stroke | null = curRef.current;
      if (!cur || !insideBoard(x, y)) continue;
      const hit = openRef.current ? sceneRef.current?.hit(x, y, openRef.current, mixRef.current >= .5) : { x, y, surface: 'auto' as const };
      if (!hit) continue;
      if (hit.surface !== surfaceRef.current) {
        strokesRef.current.push(cur);
        cur = { sauce: cur.sauce, pts: [[hit.x, hit.y, 1]], surface: hit.surface, gesture: gestureRef.current };
        curRef.current = cur; surfaceRef.current = hit.surface; added = true; continue;
      }
      const last = cur.pts.at(-1);
      if (!last) continue;
      const d = Math.hypot(hit.x - last[0], hit.y - last[1]);
      if (d < 2) continue;
      const steps = Math.ceil(d / 6);
      for (let i = 1; i <= steps; i++) cur.pts.push([last[0] + (hit.x - last[0]) * i / steps, last[1] + (hit.y - last[1]) * i / steps, 1]);
      added = true;
    }
    if (added) { void soundRef.current?.gesture('sauce'); schedule(); }
  };
  const onUp = (e?: React.PointerEvent) => {
    if (e && activePointerRef.current !== null && e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
    soundRef.current?.stop('sauce');
    if (!curRef.current) return;
    strokesRef.current.push(curRef.current); curRef.current = null;
    rebuildInk(); setStrokeCount(strokesRef.current.length); schedule();
  };
  const onCancel = (e: React.PointerEvent) => {
    if (activePointerRef.current !== null && e.pointerId !== activePointerRef.current) return;
    onUp(e);
    soundRef.current?.stop(undefined, true);
  };
  const changeType = (next: boolean) => {
    if (transitionRef.current || next === potato || !ready) return;
    onUp(); setPotato(next); setBusy(true);
    transitionRef.current = { kind: 'type', start: performance.now(), from: mixRef.current, to: next ? 1 : 0 };
    soundRef.current?.stop(); schedule();
  };
  const toggleCut = () => {
    if (transitionRef.current || !ready) return;
    onUp(); setOpened(!opened); setBusy(true);
    transitionRef.current = { kind: opened ? 'join' : 'cut', start: performance.now(), from: openRef.current, to: opened ? 0 : 1 };
    soundRef.current?.stop(); schedule();
  };
  const toggleSound = () => {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled); soundRef.current?.mute(enabled);
    try { localStorage.setItem('sosweet-sound', enabled ? 'on' : 'off'); } catch { /* optional */ }
  };

  const undo = () => {
    const lastGesture = strokesRef.current.at(-1)?.gesture;
    do { strokesRef.current.pop(); } while (lastGesture !== undefined && strokesRef.current.at(-1)?.gesture === lastGesture);
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
    rebuildInk();
    schedule();
  };
  const resetSugar = () => {
    sugarRef.current = sugarRef.current.slice(0, 1);
    setSugarLevel(0);
    rebuildInk();
    schedule();
  };
  const finish = () => {
    if (transitionRef.current || !ready) return;
    onUp();
    sugarRef.current.forEach((b) => (b.t = 0));
    potAnimRef.current = 0;
    render();
    setPreview(canvasRef.current?.toDataURL("image/png") ?? null);
  };

  return (
    <main className="sosweet-table min-h-screen overflow-x-hidden text-foreground" style={{ backgroundImage: `url(${tabletopImg}), url(${woodTextureImg})` }}>
      <Button variant="outline" size="icon" className="sound-toggle" aria-label={soundEnabled ? '효과음 켜짐' : '효과음 꺼짐'} title={soundEnabled ? '효과음 켜짐' : '효과음 꺼짐'} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 /> : <VolumeX />}</Button>
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
            <Button variant="ghost" className="text-xs" onClick={undoSugar} disabled={!sugarLevel || busy}>
              설탕 되돌리기
            </Button>
            <Button variant="ghost" className="text-xs" onClick={resetSugar} disabled={!sugarLevel || busy} aria-label="설탕 초기화">
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
            onPointerCancel={onCancel}
            onLostPointerCapture={onUp}
            aria-busy={busy}
          />
        </section>
        <div className="scene-actions flex flex-wrap justify-center gap-3">
          <div className="food-tools flex w-full flex-wrap justify-center gap-2">
            <div role="group" aria-label="핫도그 종류" className="flex gap-1">
              <Button variant={potato ? 'outline' : 'default'} className="scene-button" aria-pressed={!potato} disabled={busy || !ready} onClick={() => changeType(false)}>기본 핫도그</Button>
              <Button variant={potato ? 'default' : 'outline'} className="scene-button" aria-pressed={potato} disabled={busy || !ready} onClick={() => changeType(true)}>감자 핫도그</Button>
            </div>
            <Button variant="outline" className="scene-button" disabled={busy || !ready} onClick={toggleCut}>{opened ? <Combine /> : <Scissors />}{opened ? '다시 합치기' : '반 가르기'}</Button>
          </div>
          <Button variant="outline" className="scene-button" onClick={undo} disabled={!strokeCount || busy} aria-label="실행 취소"><Undo2 /> 실행 취소</Button>
          <Button variant="outline" className="scene-button" onClick={clearAll} disabled={!strokeCount || busy}><RotateCcw /> 다시하기</Button>
          <Button className="scene-button" onClick={finish} disabled={busy || !ready}><Check /> 완성하기</Button>
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

