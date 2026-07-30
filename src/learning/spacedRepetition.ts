import type { Grade, IntervalSkill } from "./types";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Anki-style learning steps (minutes) before a card graduates to "review". */
const LEARNING_STEPS_MIN = [1, 10];
const RELEARNING_STEPS_MIN = [10];

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const INITIAL_REVIEW_INTERVAL_DAYS = 1;

export function createNewSkill(id: IntervalSkill["id"], now: number): IntervalSkill {
  return {
    id,
    key: `${id.semitones}:${id.mode}:${id.direction ?? "na"}`,
    state: "new",
    mastery: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    reviewIntervalDays: INITIAL_REVIEW_INTERVAL_DAYS,
    learningStepIndex: 0,
    nextReview: now,
    lastReviewed: null,
    correctCount: 0,
    incorrectCount: 0,
    lapses: 0,
  };
}

/**
 * Pure SM-2-inspired scheduler. Given a skill's current scheduling state and
 * a review grade, returns the next scheduling state. Does not touch
 * `mastery` — see mastery.ts for that, kept separate so the two concerns
 * (when to show a card again vs. how well it's known) can evolve
 * independently.
 */
export function schedule(skill: IntervalSkill, grade: Grade, now: number): IntervalSkill {
  const next: IntervalSkill = { ...skill, lastReviewed: now };

  if (grade === "again") {
    next.incorrectCount += 1;
    next.easeFactor = Math.max(MIN_EASE_FACTOR, skill.easeFactor - 0.2);
    if (skill.state === "review") {
      next.lapses += 1;
      next.state = "relearning";
      next.reviewIntervalDays = Math.max(1, Math.round(skill.reviewIntervalDays * 0.5));
    } else {
      next.state = "learning";
    }
    next.learningStepIndex = 0;
    const steps = next.state === "relearning" ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;
    next.nextReview = now + steps[0] * MINUTE_MS;
    return next;
  }

  next.correctCount += 1;
  if (grade === "hard") next.easeFactor = Math.max(MIN_EASE_FACTOR, skill.easeFactor - 0.15);
  if (grade === "easy") next.easeFactor = skill.easeFactor + 0.15;

  const isLearningPhase = skill.state === "new" || skill.state === "learning" || skill.state === "relearning";

  if (isLearningPhase) {
    const steps = skill.state === "relearning" ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;

    if (grade === "hard") {
      // Repeat the current step rather than advancing.
      next.state = skill.state === "new" ? "learning" : skill.state;
      next.nextReview = now + steps[Math.min(skill.learningStepIndex, steps.length - 1)] * MINUTE_MS;
      return next;
    }

    const nextStepIndex = skill.learningStepIndex + 1;
    if (grade === "good" && nextStepIndex < steps.length) {
      next.state = skill.state === "new" ? "learning" : skill.state;
      next.learningStepIndex = nextStepIndex;
      next.nextReview = now + steps[nextStepIndex] * MINUTE_MS;
      return next;
    }

    // Graduate to "review" — either the last learning step was passed with
    // "good", or the user answered "easy" and skips the remaining steps.
    next.state = "review";
    next.learningStepIndex = 0;
    next.reviewIntervalDays = grade === "easy" ? INITIAL_REVIEW_INTERVAL_DAYS * 2 : INITIAL_REVIEW_INTERVAL_DAYS;
    next.nextReview = now + next.reviewIntervalDays * DAY_MS;
    return next;
  }

  // Already in "review" state: standard SM-2 interval growth.
  if (grade === "hard") {
    next.reviewIntervalDays = Math.max(1, skill.reviewIntervalDays * 1.2);
  } else if (grade === "good") {
    next.reviewIntervalDays = Math.max(1, skill.reviewIntervalDays * skill.easeFactor);
  } else {
    next.reviewIntervalDays = Math.max(1, skill.reviewIntervalDays * skill.easeFactor * 1.3);
  }
  next.state = "review";
  next.nextReview = now + next.reviewIntervalDays * DAY_MS;
  return next;
}
