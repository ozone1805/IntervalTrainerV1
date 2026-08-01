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
export const STATE_VERSION = 1;

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

interface QuestionBase {
  skillKey: string;
  id: SkillId;
  rootMidi: number;
  /** Tonic of the establishing cadence; ignored when context is "isolated". */
  keyRootMidi: number;
  createdAt: number;
}

/** Hear one interval, name it. */
export interface IdentifyQuestion extends QuestionBase {
  kind: "identify";
  choices: AnswerChoice[];
}

/**
 * Hear both halves of a confusion pair back to back over the same root, and
 * say which one was the target. Spacing two confusable items apart in time
 * does not teach the distinction between them — juxtaposing them does
 * (the discriminative-contrast effect), which is what this question type is
 * for. `id.semitones` is always `targetSemitones`, so the skill being
 * scheduled and scored is the target.
 */
export interface ContrastQuestion extends QuestionBase {
  kind: "contrast";
  targetSemitones: number;
  otherSemitones: number;
  targetPosition: 1 | 2;
}

export type Question = IdentifyQuestion | ContrastQuestion;
