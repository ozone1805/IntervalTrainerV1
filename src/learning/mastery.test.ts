import { describe, expect, it } from "vitest";
import { clampMastery, updateMastery } from "./mastery";

describe("updateMastery", () => {
  it("increases mastery on correct answers, faster for easier grades", () => {
    const hard = updateMastery(50, "hard", 0);
    const good = updateMastery(50, "good", 0);
    const easy = updateMastery(50, "easy", 0);
    expect(hard).toBeGreaterThan(50);
    expect(good).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(good);
  });

  it("decreases mastery on a miss", () => {
    expect(updateMastery(50, "again", 0)).toBeLessThan(50);
  });

  it("penalizes repeated lapses more harshly, up to a cap", () => {
    const first = 100 - updateMastery(100, "again", 0);
    const later = 100 - updateMastery(100, "again", 5);
    const capped = 100 - updateMastery(100, "again", 999);
    expect(later).toBeGreaterThan(first);
    expect(capped).toBeLessThanOrEqual(30);
  });

  it("never leaves the 0-100 range", () => {
    expect(clampMastery(-10)).toBe(0);
    expect(clampMastery(150)).toBe(100);
    expect(updateMastery(2, "again", 10)).toBeGreaterThanOrEqual(0);
    expect(updateMastery(98, "easy", 0)).toBeLessThanOrEqual(100);
  });
});
