import { describe, expect, it } from "vitest";
import { recordConfusion } from "./confusion";
import { createInitialState, LearningEngine } from "./engine";
import { INTRO_BLOCK_SIZE, planQuestion } from "./sessionPlanner";
import { createNewSkill } from "./spacedRepetition";
import { skillKey, type ConfusionRecord, type EngineState, type SkillId } from "./types";

const NOW = 1_700_000_000_000;

const P4: SkillId = { semitones: 5, mode: "melodic", direction: "up", context: "isolated" };
const P5: SkillId = { semitones: 7, mode: "melodic", direction: "up", context: "isolated" };

/** State where every listed skill has already been seen and is due for review. */
function stateWith(ids: SkillId[], confusion: Record<string, ConfusionRecord> = {}): EngineState {
  const skills = Object.fromEntries(
    ids.map((id) => {
      const skill = createNewSkill(id, NOW);
      return [skillKey(id), { ...skill, nextReview: NOW - 1000 }];
    }),
  );
  return { ...createInitialState(NOW), skills, confusion };
}

function muddled(a: number, b: number, times: number): Record<string, ConfusionRecord> {
  let confusion: Record<string, ConfusionRecord> = {};
  for (let i = 0; i < times; i++) {
    confusion = recordConfusion(confusion, i % 2 === 0 ? a : b, i % 2 === 0 ? b : a, NOW + i);
  }
  return confusion;
}

describe("blocked introduction", () => {
  it("repeats a freshly introduced skill for a full burst before moving on", () => {
    const engine = new LearningEngine(createInitialState(NOW));
    const rng = () => 0;

    const keys: string[] = [];
    for (let i = 0; i < INTRO_BLOCK_SIZE + 1; i++) {
      const q = engine.nextQuestion(NOW, rng);
      keys.push(q.skillKey);
      // Slow answers, so the burst runs its full length — recognizing the new
      // interval instantly cuts it short instead, covered in engine.test.ts.
      engine.submitAnswer(q, q.id.semitones, 12_000, NOW);
    }

    const burst = keys.slice(0, INTRO_BLOCK_SIZE);
    expect(new Set(burst).size).toBe(1);
    expect(keys[INTRO_BLOCK_SIZE]).not.toBe(burst[0]);
  });

  it("clears the burst once it is used up", () => {
    const state = createInitialState(NOW);
    const first = planQuestion(state, [P4], [5], NOW, () => 0);
    expect(first.session?.blockRemaining).toBe(INTRO_BLOCK_SIZE - 1);

    let session = first.session;
    for (let i = 0; i < INTRO_BLOCK_SIZE - 1; i++) {
      session = planQuestion({ ...state, session }, [P4], [5], NOW, () => 0).session;
    }
    expect(session).toBeUndefined();
  });
});

describe("variety", () => {
  it("does not ask the same skill twice in a row when something else is available", () => {
    const state = stateWith([P4, P5]);
    const asked = { ...state, reviewEvents: [{ skillKey: skillKey(P4) } as EngineState["reviewEvents"][0]] };

    // Both are due and P4 scores at least as high, but it was just asked.
    const { question } = planQuestion(asked, [P4, P5], [5, 7], NOW, () => 0);
    expect(question.skillKey).toBe(skillKey(P5));
  });

  it("repeats rather than running dry when it is the only skill available", () => {
    const state = stateWith([P4]);
    const asked = { ...state, reviewEvents: [{ skillKey: skillKey(P4) } as EngineState["reviewEvents"][0]] };

    const { question } = planQuestion(asked, [P4], [5], NOW, () => 0);
    expect(question.skillKey).toBe(skillKey(P4));
  });
});

describe("distractor choice", () => {
  it("puts the interval a target is most often mistaken for on the answer list", () => {
    const state = stateWith([P4, P5], muddled(5, 7, 4));
    const { question } = planQuestion(state, [P4], [5, 7, 4, 3], NOW, () => 0);

    expect(question.id.semitones).toBe(5);
    expect(question.choices.map((c) => c.semitones)).toContain(7);
  });
});
