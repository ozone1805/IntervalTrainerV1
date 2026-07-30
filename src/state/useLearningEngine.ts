import { useCallback, useEffect, useRef, useState } from "react";
import { pianoEngine } from "../audio/pianoEngine";
import { createInitialState, LearningEngine, type ProgressSummary } from "../learning/engine";
import type { Grade, Question } from "../learning/types";
import { getInterval } from "../music/intervals";
import { loadState, saveState } from "../storage/db";

export type AnswerPhase = "answering" | "correct-pending-grade" | "correct-done" | "incorrect";

interface FeedbackInfo {
  correct: boolean;
  correctLabel: string;
  chosenLabel: string;
}

/**
 * Bridges the pure LearningEngine to React: owns the engine instance and
 * IndexedDB persistence, and exposes a small imperative API for the UI.
 * No learning logic lives here — this is wiring only.
 */
export function useLearningEngine() {
  const engineRef = useRef<LearningEngine | null>(null);
  const questionStartRef = useRef<number>(0);
  const pendingRef = useRef<{ semitones: number; responseTimeMs: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<AnswerPhase>("answering");
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const startNewQuestion = useCallback((engine: LearningEngine) => {
    const now = Date.now();
    const q = engine.nextQuestion(now);
    questionStartRef.current = now;
    pendingRef.current = null;
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
    await pianoEngine.playInterval(question.rootMidi, question.id.semitones, question.id.mode, question.id.direction);
  }, [question]);

  const chooseAnswer = useCallback(
    (semitones: number) => {
      const engine = engineRef.current;
      if (!engine || !question || phase !== "answering") return;
      const responseTimeMs = Date.now() - questionStartRef.current;
      const correct = semitones === question.id.semitones;

      if (!correct) {
        const now = Date.now();
        const result = engine.submitAnswer(question, semitones, null, responseTimeMs, now);
        void saveState(engine.getState());
        setProgress(engine.getProgressSummary());
        setFeedback({
          correct: false,
          correctLabel: getInterval(result.correctSemitones).shortName,
          chosenLabel: getInterval(semitones).shortName,
        });
        setPhase("incorrect");
      } else {
        pendingRef.current = { semitones, responseTimeMs };
        setFeedback({
          correct: true,
          correctLabel: getInterval(question.id.semitones).shortName,
          chosenLabel: getInterval(semitones).shortName,
        });
        setPhase("correct-pending-grade");
      }
    },
    [question, phase],
  );

  const submitGrade = useCallback(
    (grade: Grade) => {
      const engine = engineRef.current;
      if (!engine || !question || !pendingRef.current || phase !== "correct-pending-grade") return;
      const now = Date.now();
      engine.submitAnswer(question, pendingRef.current.semitones, grade, pendingRef.current.responseTimeMs, now);
      void saveState(engine.getState());
      setProgress(engine.getProgressSummary());
      setPhase("correct-done");
    },
    [question, phase],
  );

  const next = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    startNewQuestion(engine);
  }, [startNewQuestion]);

  return { loading, question, phase, feedback, progress, play, chooseAnswer, submitGrade, next };
}
