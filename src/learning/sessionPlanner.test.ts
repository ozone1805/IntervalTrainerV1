import { describe, expect, it } from "vitest";
import { recordConfusion } from "./confusion";
import { createInitialState, LearningEngine } from "./engine";
import { CONTRAST_THRESHOLD, INTRO_BLOCK_SIZE, planQuestion } from "./sessionPlanner";
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
      engine.submitAnswer(q, q.kind === "contrast" ? q.targetPosition : q.id.semitones, 500, NOW);
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

describe("contrast trials", () => {
  const unlocked = [5, 7];

  it("serves a contrast trial once a pair crosses the threshold", () => {
    const state = stateWith([P4, P5], muddled(5, 7, CONTRAST_THRESHOLD));
    const { question } = planQuestion(state, [P4, P5], unlocked, NOW, () => 0);

    expect(question.kind).toBe("contrast");
    if (question.kind !== "contrast") return;
    expect(question.targetSemitones).toBe(question.id.semitones);
    expect([5, 7]).toContain(question.otherSemitones);
    expect(question.otherSemitones).not.toBe(question.targetSemitones);
  });

  it("plays both halves from the same root so only the interval differs", () => {
    const state = stateWith([P4, P5], muddled(5, 7, CONTRAST_THRESHOLD));
    const { question } = planQuestion(state, [P4, P5], unlocked, NOW, () => 0);
    expect(question.kind).toBe("contrast");
    expect(question.rootMidi).toBeGreaterThan(0);
  });

  it("stays with plain identification below the threshold", () => {
    const state = stateWith([P4, P5], muddled(5, 7, CONTRAST_THRESHOLD - 1));
    const { question } = planQuestion(state, [P4, P5], unlocked, NOW, () => 0);
    expect(question.kind).toBe("identify");
  });

  it("does not contrast during a blocked introduction", () => {
    // Confusion is on the books, but the skill itself has never been seen —
    // blocking wins, because there is nothing to discriminate against yet.
    const state = { ...createInitialState(NOW), confusion: muddled(5, 7, CONTRAST_THRESHOLD) };
    const { question, session } = planQuestion(state, [P4, P5], unlocked, NOW, () => 0);

    expect(session?.blockRemaining).toBe(INTRO_BLOCK_SIZE - 1);
    expect(question.kind).toBe("identify");
  });

  it("leaves most questions as plain identification", () => {
    const state = stateWith([P4, P5], muddled(5, 7, CONTRAST_THRESHOLD));
    // 0.9 exceeds the contrast probability, so this question stays an identify.
    const { question } = planQuestion(state, [P4, P5], unlocked, NOW, () => 0.9);
    expect(question.kind).toBe("identify");
  });
});
