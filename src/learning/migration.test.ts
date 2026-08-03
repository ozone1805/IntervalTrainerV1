import { describe, expect, it } from "vitest";
import { createInitialState } from "./engine";
import { migrateState } from "./migration";
import { STATE_VERSION } from "./types";

/** A v0 blob: no `version`, no `contextStage`, skills keyed without a context. */
const V0_STATE = {
  meta: {
    id: "local-user",
    createdAt: 1_700_000_000_000,
    totalReviews: 42,
    streak: 3,
    lastSessionDate: "2026-07-30",
    curriculumStage: 2,
    modeStage: 1,
  },
  skills: {
    "5:melodic:up": {
      id: { semitones: 5, mode: "melodic", direction: "up" },
      key: "5:melodic:up",
      state: "review",
      mastery: 82,
      easeFactor: 2.5,
      reviewIntervalDays: 4,
      learningStepIndex: 0,
      nextReview: 1_700_400_000_000,
      lastReviewed: 1_700_000_000_000,
      correctCount: 9,
      incorrectCount: 2,
      lapses: 1,
    },
  },
  confusion: { "5->7": { correctSemitones: 5, incorrectSemitones: 7, count: 4, lastOccurred: 1 } },
  reviewEvents: [],
};

describe("state migration", () => {
  it("re-keys v0 skills as isolated instead of orphaning them", () => {
    const migrated = migrateState(structuredClone(V0_STATE))!;

    expect(migrated.version).toBe(STATE_VERSION);
    expect(Object.keys(migrated.skills)).toEqual(["5:melodic:up:isolated"]);

    const skill = migrated.skills["5:melodic:up:isolated"];
    expect(skill.id.context).toBe("isolated");
    expect(skill.key).toBe("5:melodic:up:isolated");
    // The point of migrating rather than resetting: progress survives.
    expect(skill.mastery).toBe(82);
    expect(skill.correctCount).toBe(9);
  });

  it("preserves meta and confusion, and defaults the new context stage", () => {
    const migrated = migrateState(structuredClone(V0_STATE))!;

    expect(migrated.meta.contextStage).toBe(0);
    expect(migrated.meta.answerStreak).toBe(0);
    expect(migrated.meta.totalReviews).toBe(42);
    expect(migrated.meta.curriculumStage).toBe(2);
    expect(migrated.confusion["5->7"].count).toBe(4);
  });

  it("leaves current-version state untouched", () => {
    const current = createInitialState(0);
    expect(migrateState(current)).toBe(current);
  });

  it("returns null for missing state", () => {
    expect(migrateState(undefined)).toBeNull();
    expect(migrateState(null)).toBeNull();
  });
});
