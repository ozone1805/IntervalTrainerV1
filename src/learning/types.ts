import type { Direction, PlaybackMode } from "../music/intervals";

/** Self-reported confidence grade after a review, in the spirit of Anki. */
export type Grade = "again" | "hard" | "good" | "easy";

export type SkillState = "new" | "learning" | "review" | "relearning";

/**
 * A skill is one (interval, mode, direction) combination — e.g.
 * "Perfect Fourth, melodic, ascending" and "Perfect Fourth, harmonic" are
 * tracked as entirely separate skills, per the spec's generalization model.
 * Harmonic skills have no direction.
 */
export interface SkillId {
  semitones: number;
  mode: PlaybackMode;
  direction: Direction | null;
}

export function skillKey(id: SkillId): string {
  return `${id.semitones}:${id.mode}:${id.direction ?? "na"}`;
}

export interface IntervalSkill {
  id: SkillId;
  key: string;
  state: SkillState;
  mastery: number; // 0-100
  easeFactor: number; // SM-2 style, starts at 2.5
  reviewIntervalDays: number;
  learningStepIndex: number; // index into LEARNING_STEPS_MINUTES while in learning/relearning
  nextReview: number; // epoch ms
  lastReviewed: number | null;
  correctCount: number;
  incorrectCount: number;
  lapses: number;
}

/**
 * Confusion is tracked by interval identity (semitones) only, not by mode
 * or direction: the user always knows how a question was played (they
 * heard it), they're only ever guessing *which interval* it was.
 */
export interface ConfusionRecord {
  correctSemitones: number;
  incorrectSemitones: number;
  count: number;
  lastOccurred: number;
}

export interface ReviewEvent {
  timestamp: number;
  skillKey: string;
  semitones: number;
  mode: PlaybackMode;
  direction: Direction | null;
  correctSemitones: number;
  userSemitones: number;
  correct: boolean;
  grade: Grade;
  responseTimeMs: number;
}

/** 0 = ascending only, 1 = + descending, 2 = + harmonic. */
export type ModeStage = 0 | 1 | 2;

export interface UserMeta {
  id: string;
  createdAt: number;
  totalReviews: number;
  streak: number;
  lastSessionDate: string | null; // yyyy-mm-dd, for streak tracking
  curriculumStage: number;
  modeStage: ModeStage;
}

export interface EngineState {
  meta: UserMeta;
  skills: Record<string, IntervalSkill>;
  confusion: Record<string, ConfusionRecord>;
  reviewEvents: ReviewEvent[];
}

export interface AnswerChoice {
  semitones: number;
  label: string;
}

export interface Question {
  skillKey: string;
  id: SkillId;
  rootMidi: number;
  choices: AnswerChoice[];
  createdAt: number;
}
