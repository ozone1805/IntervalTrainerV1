import {
  maybeAdvanceContextStage,
  maybeAdvanceModeStage,
  maybeAdvanceStage,
  unlockedContexts,
  unlockedModes,
  unlockedSemitones,
  unlockedSkillIds,
} from "./curriculum";
import { recordConfusion, topConfusionPairs } from "./confusion";
import { updateMastery } from "./mastery";
import { planQuestion } from "./sessionPlanner";
import { createNewSkill, schedule } from "./spacedRepetition";
import {
  skillKey,
  STATE_VERSION,
  type EngineState,
  type Grade,
  type IntervalSkill,
  type Question,
  type ReviewEvent,
  type SkillId,
} from "./types";
import { getInterval } from "../music/intervals";

export interface AnswerResult {
  correct: boolean;
  grade: Grade;
  correctSemitones: number;
  skill: IntervalSkill;
}

/**
 * Correct answers are graded by how fast they were made instead of asking
 * the user to self-report — a quick answer implies confident recall, a slow
 * one implies the interval was worked out rather than recognized. Timed from
 * the moment the interval has finished sounding, so this is thinking time
 * only: listening to a long tonal cadence does not count against the user,
 * and answering before the last note dies away reads as instant recognition.
 * Replaying does not restart the clock — needing another listen is exactly
 * the hesitation this is trying to measure.
 */
const FAST_RESPONSE_MS = 3500;
const SLOW_RESPONSE_MS = 9000;

export function gradeFromResponseTime(responseTimeMs: number): Grade {
  if (responseTimeMs <= FAST_RESPONSE_MS) return "easy";
  if (responseTimeMs <= SLOW_RESPONSE_MS) return "good";
  return "hard";
}

export interface ProgressSummary {
  totalReviews: number;
  streak: number;
  curriculumStage: number;
  overallAccuracy: number | null;
  strongest: Array<{ label: string; mastery: number }>;
  weakest: Array<{ label: string; mastery: number }>;
  topConfusions: Array<{ correct: string; mistakenAs: string; count: number }>;
}

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function createInitialState(now: number, id = "local-user"): EngineState {
  return {
    version: STATE_VERSION,
    meta: {
      id,
      createdAt: now,
      totalReviews: 0,
      streak: 0,
      lastSessionDate: null,
      answerStreak: 0,
      curriculumStage: 0,
      modeStage: 0,
      contextStage: 0,
    },
    skills: {},
    confusion: {},
    reviewEvents: [],
  };
}

/**
 * Orchestrates the adaptive learning engine: curriculum unlocking, spaced
 * repetition scheduling, mastery tracking, and confusion tracking. Holds no
 * knowledge of audio or persistence — it operates purely on serializable
 * state so it can be unit tested and swapped out independently of the UI.
 */
export class LearningEngine {
  private state: EngineState;

  constructor(state: EngineState) {
    this.state = state;
  }

  getState(): EngineState {
    return this.state;
  }

  private unlockedIds(): SkillId[] {
    return unlockedSkillIds(this.state.meta, this.state.meta.modeStage);
  }

  nextQuestion(now: number, rng: () => number = Math.random): Question {
    const unlocked = this.unlockedIds();
    const semitones = unlockedSemitones(this.state.meta.curriculumStage);
    const { question, session } = planQuestion(this.state, unlocked, semitones, now, rng);
    this.state = { ...this.state, session };
    return question;
  }

  /**
   * Record the user's first answer to a question, `answer` being the chosen
   * interval in semitones. Only the first attempt is graded — see
   * `recordRetryMiss` for the guesses that follow a miss.
   */
  submitAnswer(question: Question, answer: number, responseTimeMs: number, now: number): AnswerResult {
    const correct = answer === question.id.semitones;
    const userSemitones = answer;

    const grade: Grade = correct ? gradeFromResponseTime(responseTimeMs) : "again";

    const key = question.skillKey;
    const existing = this.state.skills[key] ?? createNewSkill(question.id, now);
    const scheduled = schedule(existing, grade, now);
    const skill: IntervalSkill = { ...scheduled, mastery: updateMastery(existing.mastery, grade, existing.lapses) };

    let confusion = this.state.confusion;
    if (!correct) {
      confusion = recordConfusion(confusion, question.id.semitones, userSemitones, now);
    }

    const event: ReviewEvent = {
      timestamp: now,
      skillKey: key,
      semitones: question.id.semitones,
      mode: question.id.mode,
      direction: question.id.direction,
      context: question.id.context,
      correctSemitones: question.id.semitones,
      userSemitones,
      correct,
      grade,
      responseTimeMs,
    };

    const today = todayKey(now);
    const streak =
      this.state.meta.lastSessionDate === today
        ? this.state.meta.streak
        : this.state.meta.lastSessionDate === todayKey(now - 24 * 60 * 60 * 1000)
          ? this.state.meta.streak + 1
          : 1;

    const skills = { ...this.state.skills, [key]: skill };

    // A blocked burst exists to establish what a brand new interval sounds
    // like. Recognizing it instantly means there is nothing left to establish,
    // so the rest of the burst would just be the same question again.
    const session =
      grade === "easy" && this.state.session?.blockSkillKey === key ? undefined : this.state.session;

    const nextState: EngineState = {
      ...this.state,
      skills,
      confusion,
      session,
      reviewEvents: [...this.state.reviewEvents.slice(-499), event],
      meta: {
        ...this.state.meta,
        totalReviews: this.state.meta.totalReviews + 1,
        lastSessionDate: today,
        streak,
        answerStreak: correct ? this.state.meta.answerStreak + 1 : 0,
      },
    };

    this.state = nextState;
    this.advanceCurriculumIfReady();

    return { correct, grade, correctSemitones: question.id.semitones, skill };
  }

  /**
   * Record a wrong guess made *after* the question was already graded, i.e.
   * on a retry. Mistaking one interval for another is the same mistake
   * whether or not it was the first guess, so it feeds the confusion matrix —
   * but the skill has already been scheduled and counted, so nothing else
   * moves. Retrying must not be a way to grind extra reviews out of one
   * question.
   */
  recordRetryMiss(question: Question, answer: number, now: number): void {
    if (answer === question.id.semitones) return;
    this.state = {
      ...this.state,
      confusion: recordConfusion(this.state.confusion, question.id.semitones, answer, now),
    };
  }

  private advanceCurriculumIfReady(): void {
    const meta = this.state.meta;
    const stageSemitones = unlockedSemitones(meta.curriculumStage);
    const currentModes = unlockedModes(meta.modeStage);
    const currentContexts = unlockedContexts(meta.contextStage);

    const expectedSkills = stageSemitones.length * currentModes.length * currentContexts.length;
    const unlockedSkills = stageSemitones.flatMap((s) =>
      currentModes.flatMap((m) =>
        currentContexts
          .map(
            (context) =>
              this.state.skills[skillKey({ semitones: s, mode: m.mode, direction: m.direction, context })],
          )
          .filter((sk): sk is IntervalSkill => !!sk),
      ),
    );

    // Nothing advances until everything currently unlocked has at least been
    // heard once. The gates below average over the skills that exist, so
    // without this a single skill kept in rotation could carry the whole
    // ladder while the rest of the stage was never introduced.
    if (unlockedSkills.length < expectedSkills) return;

    const nextStage = maybeAdvanceStage(meta, unlockedSkills);
    const nextModeStage = maybeAdvanceModeStage(meta.modeStage, unlockedSkills, meta.answerStreak);
    const nextContextStage = maybeAdvanceContextStage(
      meta.contextStage,
      meta.modeStage,
      unlockedSkills,
      meta.answerStreak,
    );

    if (
      nextStage !== meta.curriculumStage ||
      nextModeStage !== meta.modeStage ||
      nextContextStage !== meta.contextStage
    ) {
      this.state = {
        ...this.state,
        meta: {
          ...meta,
          curriculumStage: nextStage,
          modeStage: nextModeStage,
          contextStage: nextContextStage,
        },
      };
    }
  }

  getProgressSummary(): ProgressSummary {
    const skills = Object.values(this.state.skills);
    const reviewed = skills.filter((s) => s.correctCount + s.incorrectCount > 0);

    const totalCorrect = reviewed.reduce((sum, s) => sum + s.correctCount, 0);
    const totalAttempts = reviewed.reduce((sum, s) => sum + s.correctCount + s.incorrectCount, 0);

    const labelFor = (skill: IntervalSkill) => {
      const interval = getInterval(skill.id.semitones);
      const dir = skill.id.direction ? ` ${skill.id.direction === "up" ? "asc" : "desc"}` : "";
      const mode = skill.id.mode === "harmonic" ? " harmonic" : "";
      const context = skill.id.context === "tonal" ? " in key" : "";
      return `${interval.shortName}${dir}${mode}${context}`;
    };

    const bySkill = [...reviewed].sort((a, b) => b.mastery - a.mastery);

    const confusions = topConfusionPairs(this.state.confusion, 5).map((c) => ({
      correct: getInterval(c.correctSemitones).shortName,
      mistakenAs: getInterval(c.incorrectSemitones).shortName,
      count: c.count,
    }));

    return {
      totalReviews: this.state.meta.totalReviews,
      streak: this.state.meta.streak,
      curriculumStage: this.state.meta.curriculumStage,
      overallAccuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : null,
      strongest: bySkill.slice(0, 3).map((s) => ({ label: labelFor(s), mastery: s.mastery })),
      weakest: bySkill
        .slice(-3)
        .reverse()
        .map((s) => ({ label: labelFor(s), mastery: s.mastery })),
      topConfusions: confusions,
    };
  }
}
