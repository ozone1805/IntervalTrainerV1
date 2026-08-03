import type { Direction, PlaybackMode, ToneContext } from "../music/intervals";

/** Self-reported confidence grade after a review, in the spirit of Anki. */
export type Grade = "again" | "hard" | "good" | "easy";

export type SkillState = "new" | "learning" | "review" | "relearning";

/**
 * A skill is one (interval, mode, direction, context) combination — e.g.
 * "Perfect Fourth, melodic, ascending, isolated" and "Perfect Fourth,
 * harmonic, in key" are tracked as entirely separate skills, per the spec's
 * generalization model. Harmonic skills have no direction.
 */
export interface SkillId {
  semitones: number;
  mode: PlaybackMode;
  direction: Direction | null;
  context: ToneContext;
}

export function skillKey(id: SkillId): string {
  return `${id.semitones}:${id.mode}:${id.direction ?? "na"}:${id.context}`;
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
  context: ToneContext;
  correctSemitones: number;
  userSemitones: number;
  correct: boolean;
  grade: Grade;
  responseTimeMs: number;
}

/** 0 = ascending only, 1 = + descending, 2 = + harmonic. */
export type ModeStage = 0 | 1 | 2;

/** 0 = bare dyads only, 1 = + intervals inside an established key. */
export type ContextStage = 0 | 1;

export interface UserMeta {
  id: string;
  createdAt: number;
  totalReviews: number;
  streak: number;
  lastSessionDate: string | null; // yyyy-mm-dd, for streak tracking
  /**
   * Consecutive first-attempt correct answers, reset to 0 by any miss. Drives
   * how fast the curriculum unlocks — see `pace` in curriculum.ts. Distinct
   * from `streak`, which counts days.
   */
  answerStreak: number;
  curriculumStage: number;
  modeStage: ModeStage;
  contextStage: ContextStage;
}

/**
 * Transient plan for the next few questions. Lives in EngineState rather than
 * on the engine instance so the engine stays a pure function of serializable
 * state, and so a blocked burst survives a page reload mid-burst.
 */
export interface SessionPlan {
  blockSkillKey: string;
  blockRemaining: number;
}

/** Bumped when the shape of persisted state changes; see migrateState. */
export const STATE_VERSION = 2;

export interface EngineState {
  version: number;
  meta: UserMeta;
  skills: Record<string, IntervalSkill>;
  confusion: Record<string, ConfusionRecord>;
  reviewEvents: ReviewEvent[];
  session?: SessionPlan;
}

export interface AnswerChoice {
  semitones: number;
  label: string;
}

/** Hear one interval, name it. */
export interface Question {
  skillKey: string;
  id: SkillId;
  rootMidi: number;
  /** Tonic of the establishing cadence; ignored when context is "isolated". */
  keyRootMidi: number;
  createdAt: number;
  choices: AnswerChoice[];
}
