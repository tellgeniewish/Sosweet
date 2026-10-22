import { DOG_RECT } from './hotdog-canvas';

export type Surface = 'auto' | 'board' | 'upper' | 'lower';
export const TYPE_DURATION = 300;
export const CUT_DURATION = 1200;
export const CUT_Y = DOG_RECT.y + DOG_RECT.h * .51;
export const BODY_END = DOG_RECT.x + DOG_RECT.w * .79;
export const FOOD_PIVOT = DOG_RECT.x + DOG_RECT.w * .39;
export const OPEN_GAP = DOG_RECT.h * .12;

export function cutProgress(elapsed: number, joining = false, reducedMotion = false) {
  const t = Math.max(0, Math.min(1, elapsed / (reducedMotion ? 1 : CUT_DURATION)));
  const opening = Math.max(0, Math.min(1, (t - .62) / .38));
  const eased = opening * opening * (3 - 2 * opening);
  return { knife: joining ? 0 : Math.min(1, t / .65), open: joining ? 1 - t * t * (3 - 2 * t) : eased, done: t === 1 };
}

export function surfaceTransform(surface: 'upper' | 'lower', open: number) {
  const sign = surface === 'upper' ? -1 : 1;
  return { angle: sign * .025 * open, dy: sign * OPEN_GAP * open };
}

export function mapSurfacePoint(x: number, y: number, surface: 'upper' | 'lower', open: number, inverse = false): [number, number] {
  const { angle, dy } = surfaceTransform(surface, open);
  const a = inverse ? -angle : angle;
  const px = x - FOOD_PIVOT, py = y - CUT_Y - (inverse ? dy : 0);
  return [FOOD_PIVOT + px * Math.cos(a) - py * Math.sin(a), CUT_Y + px * Math.sin(a) + py * Math.cos(a) + (inverse ? 0 : dy)];
}