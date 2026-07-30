import { describe, expect, it } from "vitest";
import { createNewSkill, schedule } from "./spacedRepetition";

const ID = { semitones: 5, mode: "melodic" as const, direction: "up" as const };
const NOW = 1_700_000_000_000;

describe("spaced repetition scheduler", () => {
  it("starts a new skill in the new state due immediately", () => {
    const skill = createNewSkill(ID, NOW);
    expect(skill.state).toBe("new");
    expect(skill.nextReview).toBe(NOW);
  });

  it("moves through learning steps on repeated good answers before graduating to review", () => {
    let skill = createNewSkill(ID, NOW);
    skill = schedule(skill, "good", NOW);
    expect(skill.state).toBe("learning");
    const firstStepDue = skill.nextReview;

    skill = schedule(skill, "good", firstStepDue);
    expect(skill.state).toBe("review");
    expect(skill.reviewIntervalDays).toBeGreaterThan(0);
  });

  it("graduates immediately to review on an easy answer from new", () => {
    const skill = schedule(createNewSkill(ID, NOW), "easy", NOW);
    expect(skill.state).toBe("review");
  });

  it("sends a review-state skill into relearning after a miss, and increments lapses", () => {
    let skill = createNewSkill(ID, NOW);
    skill = schedule(skill, "easy", NOW); // -> review
    const reviewInterval = skill.reviewIntervalDays;
    skill = schedule(skill, "again", skill.nextReview);
    expect(skill.state).toBe("relearning");
    expect(skill.lapses).toBe(1);
    expect(skill.reviewIntervalDays).toBeLessThan(reviewInterval);
  });

  it("grows the review interval further on repeated good answers", () => {
    let skill = createNewSkill(ID, NOW);
    skill = schedule(skill, "good", NOW);
    skill = schedule(skill, "good", skill.nextReview); // graduate
    const firstInterval = skill.reviewIntervalDays;
    skill = schedule(skill, "good", skill.nextReview);
    expect(skill.reviewIntervalDays).toBeGreaterThan(firstInterval);
  });

  it("never lets ease factor drop below the floor", () => {
    let skill = createNewSkill(ID, NOW);
    for (let i = 0; i < 20; i++) {
      skill = schedule(skill, "again", skill.nextReview);
    }
    expect(skill.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
