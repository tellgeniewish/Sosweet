import { W, H, DOG_RECT, getAssets, drawHotdog, drawSugar, drawStrokes, type Stroke, type SugarBatch } from './hotdog-canvas';
import { BODY_END, CUT_Y, FOOD_PIVOT, surfaceTransform, mapSurfacePoint, type Surface } from './food-geometry';

function layer() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  return canvas;
}

// Illustration pigments, shared by the painted potato and exposed filling.
const pigments = { potato: '#efb64e', top: '#ffda80', side: '#c88732', edge: '#ad6c2b', dough: '#ffe8ad', crumb: '#d49b49', sausage: '#cd7852', sausageLight: '#eca77f', shadow: 'rgba(94,55,27,.16)', blade: '#e5e4d8', bladeEdge: '#8c9186', handle: '#805438' };

export class FoodScene {
  private regular = layer();
  private potato = layer();
  private regularMask = layer();
  private potatoMask = layer();
  private food = layer();
  private boardInk = layer();
  private combinedInk = layer();
  private temporary = layer();
  private upper = layer();
  private lower = layer();

  constructor() {
    const assets = getAssets();
    const regular = this.regular.getContext('2d'), potato = this.potato.getContext('2d');
    if (!assets || !regular || !potato) return;
    drawHotdog(regular);
    potato.drawImage(this.regular, 0, 0);
    const rm = this.regularMask.getContext('2d');
    rm?.drawImage(assets.dog, DOG_RECT.x, DOG_RECT.y, DOG_RECT.w, DOG_RECT.h);
    const mask = this.regularMask.getContext('2d', { willReadFrequently: true });
    const pixels = mask?.getImageData(0, 0, W, H).data;
    let seed = 91;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    // A few large, simple potato cubes with generous gaps: the smooth hotdog
    // silhouette stays dominant and the cubes only hint at the potato coating.
    for (let row = 0; row < 2; row++) for (let col = 0; col < 9; col++) {
      const x = DOG_RECT.x + 130 + col * 108 + (random() - .5) * 30;
      const y = DOG_RECT.y + 130 + row * 128 + (random() - .5) * 26;
      if (random() < .16) continue;
      if (x > BODY_END - 60 || (pixels?.[((y | 0) * W + (x | 0)) * 4 + 3] ?? 0) < 160) continue;
      const size = 58 + random() * 12;
      potato.save(); potato.translate(x, y); potato.rotate((random() - .5) * .45);
      potato.fillStyle = pigments.shadow; potato.beginPath(); potato.ellipse(4, size * .4, size * .52, size * .2, 0, 0, Math.PI * 2); potato.fill();
      potato.strokeStyle = pigments.edge; potato.lineWidth = 2;
      potato.fillStyle = pigments.side;
      potato.beginPath(); potato.roundRect(-size / 2 + 4, -size / 2 + 9, size, size * .74, 9); potato.fill(); potato.stroke();
      potato.fillStyle = random() > .15 ? pigments.potato : pigments.side;
      potato.beginPath(); potato.roundRect(-size / 2, -size / 2, size, size * .74, 9); potato.fill(); potato.stroke();
      potato.strokeStyle = pigments.top; potato.lineWidth = 4; potato.lineCap = 'round';
      potato.beginPath(); potato.moveTo(-size / 2 + 9, -size / 2 + 8); potato.lineTo(size / 2 - 12, -size / 2 + 8); potato.stroke();
      potato.restore();
    }
    this.potatoMask.getContext('2d')?.drawImage(this.potato, 0, 0);
  }

  private getMask(potato: boolean) { return potato ? this.potatoMask : this.regularMask; }

  hit(x: number, y: number, open: number, potato: boolean): { x: number; y: number; surface: Surface } {
    const context = this.getMask(potato).getContext('2d', { willReadFrequently: true });
    for (const surface of ['lower', 'upper'] as const) {
      const [px, py] = mapSurfacePoint(x, y, surface, open, true);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      if (surface === 'upper' ? py > CUT_Y || px > BODY_END : py < CUT_Y && px <= BODY_END) continue;
      if ((context?.getImageData(px | 0, py | 0, 1, 1).data[3] ?? 0) > 150) return { x: px, y: py, surface };
    }
    return { x, y, surface: 'board' };
  }

  rebuild(strokes: Stroke[], sugar: SugarBatch[], now: number, potatoMix: number, board: Path2D) {
    const mask = this.getMask(potatoMix >= .5);
    const food = this.food.getContext('2d'), ink = this.combinedInk.getContext('2d'), boardInk = this.boardInk.getContext('2d');
    const temp = this.temporary.getContext('2d');
    if (!food || !ink || !boardInk || !temp) return;
    food.clearRect(0, 0, W, H);
    food.drawImage(this.regular, 0, 0);
    food.globalAlpha = potatoMix; food.drawImage(this.potato, 0, 0); food.globalAlpha = 1;
    drawSugar(food, sugar, now);
    ink.clearRect(0, 0, W, H);
    drawStrokes(ink, strokes.filter(s => !s.surface || s.surface === 'auto'));
    boardInk.clearRect(0, 0, W, H); boardInk.save(); boardInk.clip(board);
    boardInk.drawImage(this.combinedInk, 0, 0);
    boardInk.globalCompositeOperation = 'destination-out'; boardInk.drawImage(mask, 0, 0);
    boardInk.globalCompositeOperation = 'source-over';
    drawStrokes(boardInk, strokes.filter(s => s.surface === 'board'));
    boardInk.restore();
    for (const surface of ['upper', 'lower'] as const) {
      const dest = this[surface].getContext('2d');
      if (!dest) continue;
      dest.clearRect(0, 0, W, H);
      dest.drawImage(this.food, 0, 0);
      temp.clearRect(0, 0, W, H);
      drawStrokes(temp, strokes.filter(s => !s.surface || s.surface === 'auto' || s.surface === surface));
      temp.globalCompositeOperation = 'destination-in'; temp.drawImage(mask, 0, 0); temp.globalCompositeOperation = 'source-over';
      dest.drawImage(this.temporary, 0, 0);
      dest.globalCompositeOperation = 'destination-in'; dest.drawImage(mask, 0, 0); dest.globalCompositeOperation = 'source-over';
      // The entire wooden stick belongs to the lower half.
      dest.clearRect(0, surface === 'upper' ? CUT_Y : 0, surface === 'upper' ? W : BODY_END, surface === 'upper' ? H - CUT_Y : CUT_Y);
      if (surface === 'upper') dest.clearRect(BODY_END, 0, W - BODY_END, H);
    }
  }

  draw(ctx: CanvasRenderingContext2D, open: number, knife: number | null) {
    ctx.drawImage(this.boardInk, 0, 0);
    for (const surface of ['upper', 'lower'] as const) {
      const { angle, dy } = surfaceTransform(surface, open);
      ctx.save(); ctx.translate(FOOD_PIVOT, CUT_Y + dy); ctx.rotate(angle); ctx.translate(-FOOD_PIVOT, -CUT_Y);
      ctx.drawImage(this[surface], 0, 0);
      if (open > 0) {
        const x = DOG_RECT.x + 38, length = BODY_END - x - 30;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, surface === 'upper' ? CUT_Y : CUT_Y - 28 * open, length, 28 * open);
        ctx.clip();
        ctx.fillStyle = pigments.shadow; ctx.beginPath(); ctx.ellipse(x + length / 2 + 4, CUT_Y + 6, length / 2, 22 * open, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pigments.crumb; ctx.beginPath(); ctx.ellipse(x + length / 2, CUT_Y, length / 2, 28 * open, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pigments.dough; ctx.beginPath(); ctx.ellipse(x + length / 2, CUT_Y - 1, length / 2 - 5, 22 * open, 0, 0, Math.PI * 2); ctx.fill();
        const fillingY = CUT_Y + (surface === 'upper' ? 10 : -10) * open;
        ctx.fillStyle = pigments.sausage; ctx.beginPath(); ctx.ellipse(x + length / 2, fillingY, length / 2 - 24, 9 * open, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = pigments.sausageLight; ctx.lineWidth = 3 * open; ctx.beginPath(); ctx.moveTo(x + 46, fillingY - 2 * open); ctx.lineTo(x + length - 50, fillingY - 2 * open); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    if (knife !== null) {
      const x = DOG_RECT.x + 35 + (BODY_END - DOG_RECT.x - 65) * knife;
      ctx.strokeStyle = pigments.edge; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(DOG_RECT.x + 35, CUT_Y); ctx.lineTo(x, CUT_Y); ctx.stroke();
      if (knife < 1) {
        ctx.save(); ctx.translate(x, CUT_Y); ctx.rotate(-.3);
        ctx.fillStyle = pigments.blade; ctx.strokeStyle = pigments.bladeEdge; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-65, -64); ctx.lineTo(25, -64); ctx.lineTo(25, -5); ctx.quadraticCurveTo(-48, 12, -65, -64); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pigments.handle; ctx.beginPath(); ctx.roundRect(20, -63, 75, 24, 7); ctx.fill(); ctx.restore();
      }
    }
  }
}