import { useCallback, useEffect, useRef, useState } from "react";
import { pianoEngine } from "../audio/pianoEngine";
import { createInitialState, LearningEngine, type ProgressSummary } from "../learning/engine";
import type { Question } from "../learning/types";
import { getInterval } from "../music/intervals";
import { clearState, loadState, saveState } from "../storage/db";

/**
 * "retrying" is a miss that has already been graded: the answer stays hidden
 * and the user gets another go at the same sound. Hearing it again knowing
 * one option is wrong is worth more than being handed the name.
 */
export type AnswerPhase = "answering" | "retrying" | "correct";

interface FeedbackInfo {
  correct: boolean;
  message: string;
}

/** How long the result stays up before the next question appears. */
const ADVANCE_DELAY_MS = 900;

/** Longer after a miss, since there is more to take in. */
const ADVANCE_DELAY_AFTER_MISS_MS = 1700;

const name = (semitones: number) => getInterval(semitones).shortName;

/** Names what was ruled out without giving away what the interval actually was. */
function missMessage(answer: number, attempt: number): string {
  return attempt === 1
    ? `Not a ${name(answer)} — listen again and try another.`
    : `Still not it: not a ${name(answer)} either.`;
}

function correctMessage(question: Question, afterMiss: boolean): string {
  return afterMiss
    ? `Yes — that was a ${name(question.id.semitones)}.`
    : `Correct — that was a ${name(question.id.semitones)}.`;
}

/**
 * Bridges the pure LearningEngine to React: owns the engine instance and
 * IndexedDB persistence, and exposes a small imperative API for the UI.
 * No learning logic lives here — this is wiring only.
 */
export function useLearningEngine() {
  const engineRef = useRef<LearningEngine | null>(null);
  /** When the interval finished sounding, i.e. when thinking time starts. */
  const answerClockRef = useRef<number>(0);
  /** Whether `answerClockRef` has been set for the current question. */
  const clockStartedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<AnswerPhase>("answering");
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const startNewQuestion = useCallback((engine: LearningEngine) => {
    const now = Date.now();
    const q = engine.nextQuestion(now);
    answerClockRef.current = now;
    clockStartedRef.current = false;
    setQuestion(q);
    setPhase("answering");
    setWrongAnswers([]);
    setFeedback(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadState();
      const state = saved ?? createInitialState(Date.now());
      const engine = new LearningEngine(state);
      if (cancelled) return;
      engineRef.current = engine;
      setProgress(engine.getProgressSummary());
      startNewQuestion(engine);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startNewQuestion]);

  // Move on by itself once the answer is right: there is nothing left to
  // decide at that point, and a click per question adds up over a session.
  useEffect(() => {
    if (phase !== "correct") return;
    const delay = wrongAnswers.length > 0 ? ADVANCE_DELAY_AFTER_MISS_MS : ADVANCE_DELAY_MS;
    const timer = setTimeout(() => {
      const engine = engineRef.current;
      if (engine) startNewQuestion(engine);
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, wrongAnswers.length, startNewQuestion]);

  const play = useCallback(async () => {
    if (!question) return;
    const { rootMidi, keyRootMidi, id } = question;
    const seconds = await pianoEngine.playInterval(
      rootMidi,
      id.semitones,
      id.mode,
      id.direction,
      id.context,
      keyRootMidi,
    );

    // Only the first hearing starts the clock. A replay does not extend it:
    // needing to hear it again is the hesitation the grade is measuring.
    if (!clockStartedRef.current) {
      clockStartedRef.current = true;
      answerClockRef.current = Date.now() + seconds * 1000;
    }
  }, [question]);

  /**
   * Answer with an interval, in semitones. Only the first attempt is graded;
   * anything after a miss is a retry, which can still record what the user
   * confused it with but cannot earn back the review.
   */
  const chooseAnswer = useCallback(
    (semitones: number) => {
      const engine = engineRef.current;
      if (!engine || !question) return;
      const now = Date.now();

      if (phase === "answering") {
        // Negative when they answered before the last note faded — that is the
        // fastest recognition there is, so it floors at zero rather than wrapping.
        const thinkingTimeMs = Math.max(0, now - answerClockRef.current);
        const result = engine.submitAnswer(question, semitones, thinkingTimeMs, now);
        void saveState(engine.getState());
        setProgress(engine.getProgressSummary());

        if (result.correct) {
          setFeedback({ correct: true, message: correctMessage(question, false) });
          setPhase("correct");
        } else {
          setFeedback({ correct: false, message: missMessage(semitones, 1) });
          setWrongAnswers([semitones]);
          setPhase("retrying");
        }
        return;
      }

      if (phase !== "retrying" || wrongAnswers.includes(semitones)) return;

      if (semitones === question.id.semitones) {
        setFeedback({ correct: true, message: correctMessage(question, true) });
        setPhase("correct");
        return;
      }

      engine.recordRetryMiss(question, semitones, now);
      void saveState(engine.getState());
      setProgress(engine.getProgressSummary());
      setFeedback({ correct: false, message: missMessage(semitones, wrongAnswers.length + 1) });
      setWrongAnswers((prev) => [...prev, semitones]);
    },
    [question, phase, wrongAnswers],
  );

  const resetProgress = useCallback(async () => {
    await clearState();
    const engine = new LearningEngine(createInitialState(Date.now()));
    engineRef.current = engine;
    setProgress(engine.getProgressSummary());
    startNewQuestion(engine);
  }, [startNewQuestion]);

  return { loading, question, phase, wrongAnswers, feedback, progress, play, chooseAnswer, resetProgress };
}
