import type { Direction, PlaybackMode, ToneContext } from "../music/intervals";
import type { ContextStage, IntervalSkill, ModeStage, SkillId, UserMeta } from "./types";

/**
 * Progressive interval introduction (spec section 6). Each stage adds more
 * semitone intervals to the pool of things that can be practiced.
 */
export const STAGE_INTERVALS: number[][] = [
  [5, 7], // Stage 0: Perfect 4th, Perfect 5th
  [5, 7, 4], // Stage 1: + Major 3rd
  [5, 7, 4, 3], // Stage 2: + Minor 3rd
  [5, 7, 4, 3, 2, 1], // Stage 3: + Major/minor 2nd
  [5, 7, 4, 3, 2, 1, 9, 8], // Stage 4: + Major/minor 6th
  [5, 7, 4, 3, 2, 1, 9, 8, 11, 10, 6, 12], // Stage 5: full vocabulary
];

export const MAX_STAGE = STAGE_INTERVALS.length - 1;

/** Mastery an unlocked interval set needs (on average) before advancing. */
const STAGE_ADVANCE_MASTERY = 60;
const STAGE_ADVANCE_MIN_REVIEWS = 3;

/**
 * A run of first-attempt correct answers has to get this long before the
 * curriculum starts moving faster — short enough to reward a user who
 * already knows the material, long enough that a couple of lucky guesses
 * from four choices does not trigger it.
 */
const PACE_STREAK_START = 4;

/** Where the acceleration tops out. */
const PACE_STREAK_FULL = 12;

/** Points shaved off a mastery bar at full pace. */
const PACE_MASTERY_RELIEF = 18;

/** Fraction of a review-count floor that survives at full pace. */
const PACE_REVIEW_FLOOR = 0.5;

/**
 * How far to fast-track a user, from 0 (normal pace) to 1 (as fast as the
 * curriculum goes).
 *
 * The gates below exist to stop someone unlocking new material on the back of
 * a lucky guess. An unbroken run of first-attempt correct answers *is* that
 * evidence, so continuing to demand the full review count on top of it is
 * padding — and padding is what makes an ear trainer boring. At full pace the
 * gates roughly halve, which is a real speed-up without being a skip: mastery
 * still has to be earned, and a single miss drops the streak to 0 and puts the
 * full gates back.
 */
export function pace(answerStreak: number): number {
  const span = PACE_STREAK_FULL - PACE_STREAK_START;
  return Math.min(1, Math.max(0, (answerStreak - PACE_STREAK_START) / span));
}

function masteryGate(base: number, answerStreak: number): number {
  return base - pace(answerStreak) * PACE_MASTERY_RELIEF;
}

function reviewGate(base: number, answerStreak: number): number {
  return Math.max(1, Math.ceil(base * (1 - pace(answerStreak) * (1 - PACE_REVIEW_FLOOR))));
}

/**
 * Direction/mode progression: everyone starts with ascending melodic only,
 * then descending is unlocked, then harmonic — mirroring the "don't
 * overwhelm the user with all three modes at once" guidance in the spec.
 */
const MODE_UNLOCK_MASTERY = 70;
const MODE_UNLOCK_MIN_REVIEWS = 6;

/**
 * Tonal context is the last thing to unlock: hearing an interval against an
 * established key is the skill that actually transfers to real listening, but
 * it only makes sense once the raw intervals are recognizable in every mode.
 */
const CONTEXT_UNLOCK_MASTERY = 75;
const CONTEXT_UNLOCK_MIN_REVIEWS = 8;

export function unlockedSemitones(stage: number): number[] {
  return STAGE_INTERVALS[Math.min(stage, MAX_STAGE)];
}

export function unlockedModes(modeStage: ModeStage): { mode: PlaybackMode; direction: Direction | null }[] {
  const combos: { mode: PlaybackMode; direction: Direction | null }[] = [
    { mode: "melodic", direction: "up" },
  ];
  if (modeStage >= 1) combos.push({ mode: "melodic", direction: "down" });
  if (modeStage >= 2) combos.push({ mode: "harmonic", direction: null });
  return combos;
}

export function unlockedContexts(contextStage: ContextStage): ToneContext[] {
  return contextStage >= 1 ? ["isolated", "tonal"] : ["isolated"];
}

/** All (interval, mode, direction, context) skill ids currently unlocked for a user. */
export function unlockedSkillIds(meta: UserMeta, modeStage: ModeStage): SkillId[] {
  const semitones = unlockedSemitones(meta.curriculumStage);
  const modes = unlockedModes(modeStage);
  const contexts = unlockedContexts(meta.contextStage);
  const ids: SkillId[] = [];
  for (const s of semitones) {
    for (const m of modes) {
      for (const context of contexts) {
        ids.push({ semitones: s, mode: m.mode, direction: m.direction, context });
      }
    }
  }
  return ids;
}

function averageMastery(skills: IntervalSkill[]): number | null {
  const reviewed = skills.filter((s) => s.correctCount + s.incorrectCount >= 1);
  if (reviewed.length === 0) return null;
  return reviewed.reduce((sum, s) => sum + s.mastery, 0) / reviewed.length;
}

/**
 * Whether every skill has been seen enough times to trust the mastery average
 * above it — either by being reviewed `gate` times, or by having graduated out
 * of the learning steps entirely.
 *
 * That second route matters more than it looks. A skill answered instantly
 * grades "easy", which graduates it straight to a multi-day review interval,
 * so the scheduler stops offering it, so its review count stops climbing. On a
 * raw count the sharpest user would be held back hardest — penalised for
 * needing fewer repetitions. If the scheduler is confident enough to park a
 * skill for days, this gate has nothing left to check.
 */
function reviewsSatisfied(skills: IntervalSkill[], gate: number): boolean {
  return skills.every((s) => s.correctCount + s.incorrectCount >= gate || s.state === "review");
}

/**
 * Decide whether the curriculum stage should advance, based on how well the
 * currently-unlocked intervals are known. Returns the next stage (unchanged
 * if not ready to advance).
 */
export function maybeAdvanceStage(meta: UserMeta, skillsForCurrentStage: IntervalSkill[]): number {
  if (meta.curriculumStage >= MAX_STAGE) return meta.curriculumStage;
  const avg = averageMastery(skillsForCurrentStage);
  if (avg === null) return meta.curriculumStage;
  const streak = meta.answerStreak;
  if (
    avg >= masteryGate(STAGE_ADVANCE_MASTERY, streak) &&
    reviewsSatisfied(skillsForCurrentStage, reviewGate(STAGE_ADVANCE_MIN_REVIEWS, streak))
  ) {
    return meta.curriculumStage + 1;
  }
  return meta.curriculumStage;
}

/**
 * Decide whether direction/mode progression should advance (ascending ->
 * + descending -> + harmonic), based on mastery of the modes already
 * unlocked.
 */
export function maybeAdvanceModeStage(
  modeStage: ModeStage,
  skillsForUnlockedModes: IntervalSkill[],
  answerStreak: number,
): ModeStage {
  if (modeStage >= 2) return modeStage;
  const avg = averageMastery(skillsForUnlockedModes);
  if (avg === null) return modeStage;
  if (
    avg >= masteryGate(MODE_UNLOCK_MASTERY, answerStreak) &&
    reviewsSatisfied(skillsForUnlockedModes, reviewGate(MODE_UNLOCK_MIN_REVIEWS, answerStreak))
  ) {
    return (modeStage + 1) as ModeStage;
  }
  return modeStage;
}

/**
 * Decide whether to start presenting intervals inside an established key.
 * Gated behind the full mode ladder so the user isn't learning "what a
 * descending m6 sounds like" and "what it sounds like as scale degree 6→1"
 * at the same time.
 */
export function maybeAdvanceContextStage(
  contextStage: ContextStage,
  modeStage: ModeStage,
  skillsForUnlockedContexts: IntervalSkill[],
  answerStreak: number,
): ContextStage {
  if (contextStage >= 1 || modeStage < 2) return contextStage;
  const avg = averageMastery(skillsForUnlockedContexts);
  if (avg === null) return contextStage;
  if (
    avg >= masteryGate(CONTEXT_UNLOCK_MASTERY, answerStreak) &&
    reviewsSatisfied(skillsForUnlockedContexts, reviewGate(CONTEXT_UNLOCK_MIN_REVIEWS, answerStreak))
  ) {
    return 1;
  }
  return contextStage;
}
