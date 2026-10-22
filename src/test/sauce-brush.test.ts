import { describe, expect, it } from "vitest";
import { prepareSaucePoints, sauceRuns, type Stroke } from "../lib/sauce-brush";

const stroke = (sauce: string): Stroke => ({ sauce, pts: [[20, 20, 1], [50, 40, 1], [80, 20, 1]] });
describe("Sauce drawing invariants", () => {
  it("merges adjacent same-sauce crossings into one surface", () => {
    expect(sauceRuns([stroke("ketchup"), stroke("ketchup")]).map(r => r.length)).toEqual([2]);
  });
  it("preserves different-sauce drawing order", () => {
    expect(sauceRuns([stroke("ketchup"), stroke("mayo"), stroke("ketchup")]).map(r => r[0]?.sauce)).toEqual(["ketchup", "mayo", "ketchup"]);
  });
  it("keeps handwriting endpoints in their original positions", () => {
    const points = prepareSaucePoints(stroke("ketchup").pts);
    expect(points[0]?.slice(0, 2)).toEqual([20, 20]);
    expect(points.at(-1)?.slice(0, 2)).toEqual([80, 20]);
  });
  it("rebuilds exactly the same shape and width without mutating input", () => {
    const input = stroke("ketchup").pts;
    const original = structuredClone(input);
    expect(prepareSaucePoints(input)).toEqual(prepareSaucePoints(input));
    expect(input).toEqual(original);
    expect(prepareSaucePoints(input).every(p => p[2] >= .96 && p[2] <= 1.08)).toBe(true);
  });
});