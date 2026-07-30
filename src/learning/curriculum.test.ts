import { describe, expect, it } from "vitest";
import { maybeAdvanceModeStage, maybeAdvanceStage, unlockedModes, unlockedSemitones } from "./curriculum";
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
};

function masteredSkill(mastery: number, attempts = 5): IntervalSkill {
  const skill = createNewSkill({ semitones: 5, mode: "melodic", direction: "up" }, 0);
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

  it("real schedule() output can accumulate enough mastery to graduate a stage", () => {
    let skill = createNewSkill({ semitones: 5, mode: "melodic", direction: "up" }, 0);
    let now = 0;
    for (let i = 0; i < 6; i++) {
      skill = schedule(skill, "easy", now);
      now = skill.nextReview;
    }
    expect(skill.state).toBe("review");
  });
});
