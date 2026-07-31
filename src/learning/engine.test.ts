import { describe, expect, it } from "vitest";
import { createInitialState, LearningEngine } from "./engine";

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("LearningEngine", () => {
  it("only offers stage-0 intervals (P4/P5, ascending) at the start", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(1);
    for (let i = 0; i < 10; i++) {
      const q = engine.nextQuestion(i * 1000, rng);
      expect([5, 7]).toContain(q.id.semitones);
      expect(q.id.mode).toBe("melodic");
      expect(q.id.direction).toBe("up");
      expect(q.choices.some((c) => c.semitones === q.id.semitones)).toBe(true);
    }
  });

  it("records confusion when the user answers incorrectly", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(2);
    const q = engine.nextQuestion(0, rng);
    const wrongChoice = q.choices.find((c) => c.semitones !== q.id.semitones)!;
    const result = engine.submitAnswer(q, wrongChoice.semitones, 1500, 0);
    expect(result.correct).toBe(false);
    expect(result.grade).toBe("again");
    const confusionKey = `${q.id.semitones}->${wrongChoice.semitones}`;
    expect(engine.getState().confusion[confusionKey]?.count).toBe(1);
  });

  it("increases mastery and totalReviews on a correct answer", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(3);
    const q = engine.nextQuestion(0, rng);
    const result = engine.submitAnswer(q, q.id.semitones, 1000, 0);
    expect(result.correct).toBe(true);
    expect(result.skill.mastery).toBeGreaterThan(0);
    expect(engine.getState().meta.totalReviews).toBe(1);
  });

  it("advances the curriculum stage after sustained mastery of stage-0 intervals", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(4);
    let now = 0;
    for (let i = 0; i < 40 && engine.getState().meta.curriculumStage === 0; i++) {
      const q = engine.nextQuestion(now, rng);
      engine.submitAnswer(q, q.id.semitones, 500, now);
      now += 2 * 24 * 60 * 60 * 1000; // fast-forward well past any scheduled review
    }
    expect(engine.getState().meta.curriculumStage).toBeGreaterThan(0);
  });

  it("produces a sensible progress summary", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(5);
    for (let i = 0; i < 5; i++) {
      const q = engine.nextQuestion(i * 1000, rng);
      engine.submitAnswer(q, q.id.semitones, 800, i * 1000);
    }
    const summary = engine.getProgressSummary();
    expect(summary.totalReviews).toBe(5);
    expect(summary.overallAccuracy).toBe(1);
    expect(summary.strongest.length).toBeGreaterThan(0);
  });
});
