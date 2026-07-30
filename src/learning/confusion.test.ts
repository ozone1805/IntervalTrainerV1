import { describe, expect, it } from "vitest";
import { confusionScoreFor, recordConfusion, topConfusionPairs, topConfusionsFor } from "./confusion";

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
