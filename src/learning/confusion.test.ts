import { describe, expect, it } from "vitest";
import {
  confusionScoreFor,
  eligibleContrastPairs,
  recordConfusion,
  symmetricConfusionCount,
  topConfusionPairs,
  topConfusionsFor,
} from "./confusion";

describe("confusion tracking", () => {
  it("accumulates counts for repeated confusion pairs", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 5, 7, 1000); // P4 heard, answered P5
    confusion = recordConfusion(confusion, 5, 7, 2000);
    confusion = recordConfusion(confusion, 5, 4, 3000); // P4 heard, answered M3

    expect(confusionScoreFor(confusion, 5)).toBe(3);
    expect(topConfusionsFor(confusion, 5, 1)[0].incorrectSemitones).toBe(7);
    expect(topConfusionsFor(confusion, 5, 1)[0].count).toBe(2);
  });

  it("keeps confusion pairs directional (order matters)", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 5, 7, 1000);
    confusion = recordConfusion(confusion, 7, 5, 1000);
    expect(Object.keys(confusion)).toHaveLength(2);
  });

  it("ranks global confusion pairs by count", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 5, 7, 1000);
    confusion = recordConfusion(confusion, 3, 4, 1000);
    confusion = recordConfusion(confusion, 3, 4, 2000);
    const top = topConfusionPairs(confusion, 2);
    expect(top[0].correctSemitones).toBe(3);
    expect(top[0].count).toBe(2);
  });
});

describe("contrast pair selection", () => {
  it("counts a pair's confusion in both directions", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 5, 7, 1000); // P4 heard, answered P5
    confusion = recordConfusion(confusion, 7, 5, 2000); // P5 heard, answered P4

    // Each direction alone looks mild; together the pair is clearly muddled.
    expect(confusionScoreFor(confusion, 5)).toBe(1);
    expect(symmetricConfusionCount(confusion, 5, 7)).toBe(2);
    expect(symmetricConfusionCount(confusion, 7, 5)).toBe(2);
  });

  it("surfaces a pair muddled both ways that neither direction alone would reach", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 5, 7, 1000);
    confusion = recordConfusion(confusion, 7, 5, 2000);

    const pairs = eligibleContrastPairs(confusion, [5, 7], 2);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 5, b: 7, count: 2 });
  });

  it("ignores pairs below the threshold", () => {
    const confusion = recordConfusion({}, 5, 7, 1000);
    expect(eligibleContrastPairs(confusion, [5, 7], 2)).toHaveLength(0);
  });

  it("ignores pairs whose partner is not unlocked yet", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 5, 11, 1000);
    confusion = recordConfusion(confusion, 5, 11, 2000);
    expect(eligibleContrastPairs(confusion, [5, 7], 2)).toHaveLength(0);
  });

  it("ranks the most confused pair first and reports each pair once", () => {
    let confusion = {};
    confusion = recordConfusion(confusion, 3, 4, 1000);
    confusion = recordConfusion(confusion, 4, 3, 2000);
    confusion = recordConfusion(confusion, 3, 4, 3000);
    confusion = recordConfusion(confusion, 5, 7, 1000);
    confusion = recordConfusion(confusion, 5, 7, 2000);

    const pairs = eligibleContrastPairs(confusion, [3, 4, 5, 7], 2);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ a: 3, b: 4, count: 3 });
    expect(pairs[1]).toMatchObject({ a: 5, b: 7, count: 2 });
  });
});
