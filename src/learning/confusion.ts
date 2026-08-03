import type { ConfusionRecord } from "./types";

function pairKey(correctSemitones: number, incorrectSemitones: number): string {
  return `${correctSemitones}->${incorrectSemitones}`;
}

/** Record a mistake: the user heard `correctSemitones` and answered `incorrectSemitones`. */
export function recordConfusion(
  confusion: Record<string, ConfusionRecord>,
  correctSemitones: number,
  incorrectSemitones: number,
  now: number,
): Record<string, ConfusionRecord> {
  const key = pairKey(correctSemitones, incorrectSemitones);
  const existing = confusion[key];
  const updated: ConfusionRecord = existing
    ? { ...existing, count: existing.count + 1, lastOccurred: now }
    : { correctSemitones, incorrectSemitones, count: 1, lastOccurred: now };
  return { ...confusion, [key]: updated };
}

/** Total times `semitones` has been mistaken for something else, used to boost review priority. */
export function confusionScoreFor(confusion: Record<string, ConfusionRecord>, semitones: number): number {
  let total = 0;
  for (const record of Object.values(confusion)) {
    if (record.correctSemitones === semitones) total += record.count;
  }
  return total;
}

/** The intervals most often confused with `semitones`, most-confused first. */
export function topConfusionsFor(
  confusion: Record<string, ConfusionRecord>,
  semitones: number,
  limit: number,
): ConfusionRecord[] {
  return Object.values(confusion)
    .filter((r) => r.correctSemitones === semitones)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Global top confusion pairs, for the progress screen. */
export function topConfusionPairs(confusion: Record<string, ConfusionRecord>, limit: number): ConfusionRecord[] {
  return Object.values(confusion)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
