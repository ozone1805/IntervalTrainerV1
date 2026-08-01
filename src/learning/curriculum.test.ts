import { describe, expect, it } from "vitest";
import {
  maybeAdvanceContextStage,
  maybeAdvanceModeStage,
  maybeAdvanceStage,
  unlockedContexts,
  unlockedModes,
  unlockedSemitones,
  unlockedSkillIds,
} from "./curriculum";
import { createNewSkill, schedule } from "./spacedRepetition";
import type { IntervalSkill, UserMeta } from "./types";

const meta: UserMeta = {
  id: "u",
  createdAt: 0,
  totalReviews: 0,
  streak: 0,
  lastSessionDate: null,
  curriculumStage: 0,
  modeStage: 0,
  contextStage: 0,
};

const ID = { semitones: 5, mode: "melodic" as const, direction: "up" as const, context: "isolated" as const };

function masteredSkill(mastery: number, attempts = 5): IntervalSkill {
  const skill = createNewSkill(ID, 0);
  return { ...skill, mastery, correctCount: attempts, incorrectCount: 0 };
}

describe("curriculum progression", () => {
  it("stage 0 unlocks only P4 and P5", () => {
    expect(unlockedSemitones(0)).toEqual([5, 7]);
  });

  it("mode stage 0 is ascending-only", () => {
    expect(unlockedModes(0)).toEqual([{ mode: "melodic", direction: "up" }]);
  });

  it("does not advance stage without enough reviews even if mastery is high", () => {
    const skills = [masteredSkill(90, 1)];
    expect(maybeAdvanceStage(meta, skills)).toBe(0);
  });

  it("advances stage once average mastery and review count thresholds are met", () => {
    const skills = [masteredSkill(90), masteredSkill(85)];
    expect(maybeAdvanceStage(meta, skills)).toBe(1);
  });

  it("does not advance stage when mastery is still low", () => {
    const skills = [masteredSkill(40), masteredSkill(50)];
    expect(maybeAdvanceStage(meta, skills)).toBe(0);
  });

  it("unlocks descending once ascending mastery is high enough", () => {
    const skills = [masteredSkill(80, 8), masteredSkill(75, 8)];
    expect(maybeAdvanceModeStage(0, skills)).toBe(1);
  });

  it("holds tonal context back until every mode is unlocked", () => {
    const strong = [masteredSkill(95, 20), masteredSkill(95, 20)];
    expect(maybeAdvanceContextStage(0, 0, strong)).toBe(0);
    expect(maybeAdvanceContextStage(0, 1, strong)).toBe(0);
    expect(maybeAdvanceContextStage(0, 2, strong)).toBe(1);
  });

  it("does not unlock tonal context on weak mastery even at the final mode stage", () => {
    expect(maybeAdvanceContextStage(0, 2, [masteredSkill(50, 20)])).toBe(0);
  });

  it("only offers isolated skills until the context stage advances", () => {
    expect(unlockedContexts(0)).toEqual(["isolated"]);
    expect(unlockedContexts(1)).toEqual(["isolated", "tonal"]);

    const isolatedOnly = unlockedSkillIds(meta, 0);
    expect(isolatedOnly.every((id) => id.context === "isolated")).toBe(true);

    const withTonal = unlockedSkillIds({ ...meta, contextStage: 1 }, 0);
    expect(withTonal.some((id) => id.context === "tonal")).toBe(true);
    expect(withTonal).toHaveLength(isolatedOnly.length * 2);
  });

  it("real schedule() output can accumulate enough mastery to graduate a stage", () => {
    let skill = createNewSkill(ID, 0);
    let now = 0;
    for (let i = 0; i < 6; i++) {
      skill = schedule(skill, "easy", now);
      now = skill.nextReview;
    }
    expect(skill.state).toBe("review");
  });
});
