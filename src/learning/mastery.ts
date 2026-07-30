import type { Grade } from "./types";

const MASTERY_MIN = 0;
const MASTERY_MAX = 100;

/** How much of the remaining gap to 100 is closed on a correct answer. */
const GAIN_RATE: Record<Exclude<Grade, "again">, number> = {
  hard: 0.05,
  good: 0.15,
  easy: 0.25,
};

/** Flat mastery penalty for a missed answer, harsher after repeated lapses. */
const AGAIN_PENALTY_BASE = 12;
const AGAIN_PENALTY_PER_LAPSE = 3;
const AGAIN_PENALTY_MAX = 30;

export function clampMastery(value: number): number {
  return Math.min(MASTERY_MAX, Math.max(MASTERY_MIN, value));
}

/**
 * Update a skill's mastery score given a review grade. `lapses` is the
 * skill's lapse count *before* this review (used to make repeated failures
 * hurt progressively more, without being punished by unrelated skills).
 */
export function updateMastery(currentMastery: number, grade: Grade, lapses: number): number {
  if (grade === "again") {
    const penalty = Math.min(AGAIN_PENALTY_MAX, AGAIN_PENALTY_BASE + lapses * AGAIN_PENALTY_PER_LAPSE);
    return clampMastery(currentMastery - penalty);
  }
  const rate = GAIN_RATE[grade];
  return clampMastery(currentMastery + (MASTERY_MAX - currentMastery) * rate);
}
