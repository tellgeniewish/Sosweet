import { describe, expect, it, vi } from 'vitest';
import { CUT_DURATION, TYPE_DURATION, cutProgress, mapSurfacePoint, surfaceTransform } from '../lib/food-geometry';
import { FoodSound } from '../lib/food-sound';

describe('Food interaction rules', () => {
  it('changes food type in 300 ms within the requested 0.2–0.4 seconds', () => {
    expect(TYPE_DURATION).toBe(300);
  });
  it('finishes a longitudinal cut in 1200 ms and rejoins completely', () => {
    expect(CUT_DURATION).toBe(1200);
    expect(cutProgress(1199).done).toBe(false);
    expect(cutProgress(1200)).toEqual({ knife: 1, open: 1, done: true });
    expect(cutProgress(1200, true).open).toBe(0);
  });
  it('moves halves apart and maps opened edits back to their original coordinates', () => {
    expect(surfaceTransform('upper', 1).dy).toBeLessThan(0);
    expect(surfaceTransform('lower', 1).dy).toBeGreaterThan(0);
    for (const surface of ['upper', 'lower'] as const) {
      const moved = mapSurfacePoint(450, 620, surface, 1);
      const original = mapSurfacePoint(...moved, surface, 1, true);
      expect(original[0]).toBeCloseTo(450, 8);
      expect(original[1]).toBeCloseTo(620, 8);
      expect(mapSurfacePoint(450, 620, surface, 0)).toEqual([450, 620]);
    }
  });
});

describe('Quiet cancellable tool audio', () => {
  function setupAudio() {
    const ramps: number[][] = [];
    const gains: Array<{ gain: { value: number; cancelScheduledValues: ReturnType<typeof vi.fn>; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; setTargetAtTime: ReturnType<typeof vi.fn> } }> = [];
    class MockAudioContext {
      sampleRate = 20;
      currentTime = 0;
      state = 'running';
      destination = {};
      createBuffer() { return { getChannelData: () => new Float32Array(40) }; }
      createBufferSource() { return { playbackRate: { value: 0 }, connect: () => ({ connect: () => {} }), start: vi.fn(), stop: vi.fn() }; }
      createBiquadFilter() { return { frequency: { value: 0 } }; }
      createGain() {
        const levels: number[] = [];
        ramps.push(levels);
        const node = { gain: { value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn((value: number) => levels.push(value)), setTargetAtTime: vi.fn() } };
        gains.push(node);
        return node;
      }
      close() { return Promise.resolve(); }
    }
    vi.stubGlobal('AudioContext', MockAudioContext);
    return { ramps, gains };
  }
  it('defaults to sound enabled with sugar quieter than sauce', async () => {
    const { ramps } = setupAudio();
    const sound = new FoodSound();
    expect(sound.enabled).toBe(true);
    await sound.gesture('sauce');
    await sound.gesture('sugar');
    expect(ramps).toEqual([[.11], [.045]]);
    sound.dispose();
    vi.unstubAllGlobals();
  });
  it('cancels pending audio before it can restart after pointer cancellation', async () => {
    const { ramps, gains } = setupAudio();
    const sound = new FoodSound();
    const pending = sound.gesture('sauce');
    sound.stop(undefined, true);
    await pending;
    expect(ramps).toEqual([[], []]);
    expect(gains[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    sound.dispose();
    vi.unstubAllGlobals();
  });
  it('mute stops both tools immediately and blocks further gestures', async () => {
    const { ramps, gains } = setupAudio();
    const sound = new FoodSound();
    await sound.gesture('sauce');
    sound.mute(false);
    await sound.gesture('sugar');
    expect(ramps).toEqual([[.11], []]);
    for (const gain of gains) expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    sound.dispose();
    vi.unstubAllGlobals();
  });
});