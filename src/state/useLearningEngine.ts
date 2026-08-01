import { useCallback, useEffect, useRef, useState } from "react";
import { pianoEngine } from "../audio/pianoEngine";
import { createInitialState, LearningEngine, type ProgressSummary } from "../learning/engine";
import type { Question } from "../learning/types";
import { getInterval } from "../music/intervals";
import { clearState, loadState, saveState } from "../storage/db";

export type AnswerPhase = "answering" | "correct-done" | "incorrect";

interface FeedbackInfo {
  correct: boolean;
  message: string;
}

const POSITION_WORDS = ["", "first", "second"] as const;

function describeAnswer(question: Question, answer: number, correct: boolean): string {
  const name = (semitones: number) => getInterval(semitones).shortName;

  if (question.kind === "contrast") {
    const where = POSITION_WORDS[question.targetPosition];
    const target = name(question.targetSemitones);
    return correct
      ? `Correct — the ${target} was ${where}.`
      : `Not quite. The ${target} was ${where}; the other was a ${name(question.otherSemitones)}.`;
  }

  return correct
    ? `Correct — that was a ${name(question.id.semitones)}.`
    : `Not quite. You answered ${name(answer)}; it was ${name(question.id.semitones)}.`;
}

/**
 * Bridges the pure LearningEngine to React: owns the engine instance and
 * IndexedDB persistence, and exposes a small imperative API for the UI.
 * No learning logic lives here — this is wiring only.
 */
export function useLearningEngine() {
  const engineRef = useRef<LearningEngine | null>(null);
  const questionStartRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<AnswerPhase>("answering");
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const startNewQuestion = useCallback((engine: LearningEngine) => {
    const now = Date.now();
    const q = engine.nextQuestion(now);
    questionStartRef.current = now;
    setQuestion(q);
    setPhase("answering");
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

  const play = useCallback(async () => {
    if (!question) return;
    const { rootMidi, keyRootMidi, id } = question;

    if (question.kind === "contrast") {
      const targetFirst = question.targetPosition === 1;
      const first = targetFirst ? question.targetSemitones : question.otherSemitones;
      const second = targetFirst ? question.otherSemitones : question.targetSemitones;
      await pianoEngine.playContrast(rootMidi, first, second, id.mode, id.direction, id.context, keyRootMidi);
      return;
    }

    await pianoEngine.playInterval(rootMidi, id.semitones, id.mode, id.direction, id.context, keyRootMidi);
  }, [question]);

  /** `answer` is a semitone count for identify questions, a position for contrast trials. */
  const chooseAnswer = useCallback(
    (answer: number) => {
      const engine = engineRef.current;
      if (!engine || !question || phase !== "answering") return;
      const responseTimeMs = Date.now() - questionStartRef.current;
      const now = Date.now();

      const result = engine.submitAnswer(question, answer, responseTimeMs, now);
      void saveState(engine.getState());
      setProgress(engine.getProgressSummary());
      setFeedback({ correct: result.correct, message: describeAnswer(question, answer, result.correct) });
      setPhase(result.correct ? "correct-done" : "incorrect");
    },
    [question, phase],
  );

  const next = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    startNewQuestion(engine);
  }, [startNewQuestion]);

  const resetProgress = useCallback(async () => {
    await clearState();
    const engine = new LearningEngine(createInitialState(Date.now()));
    engineRef.current = engine;
    setProgress(engine.getProgressSummary());
    startNewQuestion(engine);
  }, [startNewQuestion]);

  return { loading, question, phase, feedback, progress, play, chooseAnswer, next, resetProgress };
}
