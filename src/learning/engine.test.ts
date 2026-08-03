import { describe, expect, it } from "vitest";
import { MAX_STAGE, unlockedSemitones } from "./curriculum";
import { createInitialState, LearningEngine } from "./engine";
import { INTRO_BLOCK_SIZE } from "./sessionPlanner";

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function atStage(curriculumStage: number) {
  const state = createInitialState(0);
  return { ...state, meta: { ...state.meta, curriculumStage } };
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
      expect(q.id.context).toBe("isolated");
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

  it("counts a retry miss as confusion but not as another review", () => {
    // Stage 2 so the question has enough choices to get two of them wrong.
    const engine = new LearningEngine(atStage(2));
    const rng = seededRng(6);
    const q = engine.nextQuestion(0, rng);
    const wrong = q.choices.filter((c) => c.semitones !== q.id.semitones);

    engine.submitAnswer(q, wrong[0].semitones, 1500, 0);
    const afterFirstAttempt = engine.getState();
    engine.recordRetryMiss(q, wrong[1].semitones, 1000);

    const state = engine.getState();
    expect(state.confusion[`${q.id.semitones}->${wrong[1].semitones}`]?.count).toBe(1);
    expect(state.meta.totalReviews).toBe(afterFirstAttempt.meta.totalReviews);
    expect(state.reviewEvents).toHaveLength(afterFirstAttempt.reviewEvents.length);
    expect(state.skills).toEqual(afterFirstAttempt.skills);
  });

  it("ignores a retry that lands on the right answer", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(7);
    const q = engine.nextQuestion(0, rng);
    const wrong = q.choices.find((c) => c.semitones !== q.id.semitones)!;

    engine.submitAnswer(q, wrong.semitones, 1500, 0);
    const before = engine.getState();
    engine.recordRetryMiss(q, q.id.semitones, 1000);

    // Getting there on the second try does not undo the miss, and does not
    // record the correct interval as something it was confused with.
    expect(engine.getState()).toEqual(before);
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

  it("counts consecutive correct answers and zeroes the run on a miss", () => {
    const engine = new LearningEngine(atStage(2));
    const rng = seededRng(8);
    let now = 0;
    for (let i = 0; i < 3; i++) {
      const q = engine.nextQuestion(now, rng);
      engine.submitAnswer(q, q.id.semitones, 500, now);
      now += 60_000;
    }
    expect(engine.getState().meta.answerStreak).toBe(3);

    const q = engine.nextQuestion(now, rng);
    const wrong = q.choices.find((c) => c.semitones !== q.id.semitones)!;
    engine.submitAnswer(q, wrong.semitones, 500, now);
    expect(engine.getState().meta.answerStreak).toBe(0);
  });

  it("reaches the full curriculum quickly for a fast, consistently correct user", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(9);
    let now = 0;
    let asked = 0;
    while (engine.getState().meta.curriculumStage < MAX_STAGE && asked < 200) {
      const q = engine.nextQuestion(now, rng);
      engine.submitAnswer(q, q.id.semitones, 500, now);
      asked += 1;
      now += 60_000;
    }

    expect(engine.getState().meta.curriculumStage).toBe(MAX_STAGE);
    // Roughly 17 in practice. This is a guard against the curriculum stalling
    // on a user who knows the material, not a pin on the exact tuning.
    expect(asked).toBeLessThan(50);
  });

  it("introduces every interval in a stage instead of drilling one of them", () => {
    // Answering correctly but slowly keeps a skill in the 1-minute learning
    // steps, so it falls due again immediately. It must not crowd out the
    // intervals that have never been heard.
    const engine = new LearningEngine(createInitialState(0));
    const rng = seededRng(10);
    let now = 0;
    for (let i = 0; i < 12; i++) {
      const q = engine.nextQuestion(now, rng);
      engine.submitAnswer(q, q.id.semitones, 12_000, now);
      now += 60_000;
    }

    const seen = new Set(Object.values(engine.getState().skills).map((s) => s.id.semitones));
    expect(seen).toEqual(new Set(unlockedSemitones(0)));
  });

  it("holds the curriculum back until every unlocked interval has been heard", () => {
    // One skill drilled to high mastery is not a mastered stage.
    const engine = new LearningEngine(createInitialState(0));
    const rng = () => 0;
    let now = 0;
    const first = engine.nextQuestion(now, rng);
    for (let i = 0; i < 10; i++) {
      engine.submitAnswer(first, first.id.semitones, 500, now);
      now += 60_000;
    }

    expect(Object.keys(engine.getState().skills)).toHaveLength(1);
    expect(engine.getState().meta.curriculumStage).toBe(0);
  });

  it("drops the rest of a blocked burst when the new interval is recognized instantly", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = () => 0;
    const q = engine.nextQuestion(0, rng);
    expect(engine.getState().session?.blockRemaining).toBe(INTRO_BLOCK_SIZE - 1);

    engine.submitAnswer(q, q.id.semitones, 500, 0); // fast + correct => "easy"
    expect(engine.getState().session).toBeUndefined();
  });

  it("keeps the burst when the new interval was worked out slowly", () => {
    const engine = new LearningEngine(createInitialState(0));
    const rng = () => 0;
    const q = engine.nextQuestion(0, rng);

    engine.submitAnswer(q, q.id.semitones, 12_000, 0); // correct but slow => "hard"
    expect(engine.getState().session?.blockRemaining).toBe(INTRO_BLOCK_SIZE - 1);
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
