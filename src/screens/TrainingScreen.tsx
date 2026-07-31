import { useEffect, useState } from "react";
import type { useLearningEngine } from "../state/useLearningEngine";

type Engine = ReturnType<typeof useLearningEngine>;

function modeLabel(mode: "melodic" | "harmonic", direction: "up" | "down" | null): string {
  if (mode === "harmonic") return "Harmonic";
  return direction === "down" ? "Descending" : "Ascending";
}

export function TrainingScreen({ engine }: { engine: Engine }) {
  const { question, phase, feedback, play, chooseAnswer, next } = engine;
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setHasPlayed(false);
  }, [question]);

  if (!question) return null;

  const handlePlay = async () => {
    setPlaying(true);
    try {
      await play();
      setHasPlayed(true);
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div className="training">
      <p className="mode-label">{modeLabel(question.id.mode, question.id.direction)} interval</p>

      <div className="play-row">
        <button className="btn btn-primary" onClick={handlePlay} disabled={playing}>
          {playing ? "Playing…" : "▶ Play"}
        </button>
        <button className="btn" onClick={handlePlay} disabled={!hasPlayed || playing}>
          ↻ Replay
        </button>
      </div>

      <div className="choices">
        {question.choices.map((choice) => (
          <button
            key={choice.semitones}
            className="btn choice"
            disabled={!hasPlayed || phase !== "answering"}
            onClick={() => chooseAnswer(choice.semitones)}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className={`feedback ${feedback.correct ? "feedback-correct" : "feedback-incorrect"}`}>
          {feedback.correct ? (
            <p>Correct — that was a {feedback.correctLabel}.</p>
          ) : (
            <p>
              Not quite. You answered {feedback.chosenLabel}; it was {feedback.correctLabel}.
            </p>
          )}
        </div>
      )}

      {(phase === "incorrect" || phase === "correct-done") && (
        <button className="btn btn-primary next-btn" onClick={next}>
          Next question →
        </button>
      )}
    </div>
  );
}
