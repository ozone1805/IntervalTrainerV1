import type { Direction, PlaybackMode } from "../music/intervals";
import type { IntervalSkill, ModeStage, SkillId, UserMeta } from "./types";

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
 * Direction/mode progression: everyone starts with ascending melodic only,
 * then descending is unlocked, then harmonic — mirroring the "don't
 * overwhelm the user with all three modes at once" guidance in the spec.
 */
const MODE_UNLOCK_MASTERY = 70;
const MODE_UNLOCK_MIN_REVIEWS = 6;

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

/** All (interval, mode, direction) skill ids currently unlocked for a user. */
export function unlockedSkillIds(meta: UserMeta, modeStage: ModeStage): SkillId[] {
  const semitones = unlockedSemitones(meta.curriculumStage);
  const modes = unlockedModes(modeStage);
  const ids: SkillId[] = [];
  for (const s of semitones) {
    for (const m of modes) {
      ids.push({ semitones: s, mode: m.mode, direction: m.direction });
    }
  }
  return ids;
}

function averageMastery(skills: IntervalSkill[]): number | null {
  const reviewed = skills.filter((s) => s.correctCount + s.incorrectCount >= 1);
  if (reviewed.length === 0) return null;
  return reviewed.reduce((sum, s) => sum + s.mastery, 0) / reviewed.length;
}

function minReviews(skills: IntervalSkill[]): number {
  if (skills.length === 0) return 0;
  return Math.min(...skills.map((s) => s.correctCount + s.incorrectCount));
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
  if (avg >= STAGE_ADVANCE_MASTERY && minReviews(skillsForCurrentStage) >= STAGE_ADVANCE_MIN_REVIEWS) {
    return meta.curriculumStage + 1;
  }
  return meta.curriculumStage;
}

/**
 * Decide whether direction/mode progression should advance (ascending ->
 * + descending -> + harmonic), based on mastery of the modes already
 * unlocked.
 */
export function maybeAdvanceModeStage(modeStage: ModeStage, skillsForUnlockedModes: IntervalSkill[]): ModeStage {
  if (modeStage >= 2) return modeStage;
  const avg = averageMastery(skillsForUnlockedModes);
  if (avg === null) return modeStage;
  if (avg >= MODE_UNLOCK_MASTERY && minReviews(skillsForUnlockedModes) >= MODE_UNLOCK_MIN_REVIEWS) {
    return (modeStage + 1) as ModeStage;
  }
  return modeStage;
}
