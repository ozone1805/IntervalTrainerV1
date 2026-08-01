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

export interface ContrastPair {
  a: number;
  b: number;
  count: number;
  lastOccurred: number;
}

/**
 * How muddled two intervals are with each other, counting mistakes in both
 * directions. Confusion is a property of the *pair*: someone who answers P5
 * for a P4 half the time and P4 for a P5 the other half is equally confused
 * either way, but each one-way tally on its own reads as mild.
 */
export function symmetricConfusionCount(
  confusion: Record<string, ConfusionRecord>,
  a: number,
  b: number,
): number {
  const forward = confusion[pairKey(a, b)]?.count ?? 0;
  const backward = confusion[pairKey(b, a)]?.count ?? 0;
  return forward + backward;
}

/**
 * Pairs muddled often enough to be worth drilling side by side, most confused
 * first. Both members must currently be unlocked — there is no point
 * contrasting against an interval the user hasn't met yet.
 */
export function eligibleContrastPairs(
  confusion: Record<string, ConfusionRecord>,
  unlockedSemitones: number[],
  threshold: number,
): ContrastPair[] {
  const unlocked = new Set(unlockedSemitones);
  const seen = new Set<string>();
  const pairs: ContrastPair[] = [];

  for (const record of Object.values(confusion)) {
    const { correctSemitones: x, incorrectSemitones: y } = record;
    if (!unlocked.has(x) || !unlocked.has(y)) continue;

    const [a, b] = x < y ? [x, y] : [y, x];
    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const count = symmetricConfusionCount(confusion, a, b);
    if (count < threshold) continue;

    const lastOccurred = Math.max(
      confusion[pairKey(a, b)]?.lastOccurred ?? 0,
      confusion[pairKey(b, a)]?.lastOccurred ?? 0,
    );
    pairs.push({ a, b, count, lastOccurred });
  }

  return pairs.sort((p, q) => q.count - p.count || q.lastOccurred - p.lastOccurred);
}
