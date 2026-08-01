import { useEffect, useState } from "react";
import { getInterval, type Direction, type PlaybackMode, type ToneContext } from "../music/intervals";
import type { useLearningEngine } from "../state/useLearningEngine";

type Engine = ReturnType<typeof useLearningEngine>;

function modeLabel(mode: PlaybackMode, direction: Direction | null, context: ToneContext): string {
  const shape = mode === "harmonic" ? "Harmonic" : direction === "down" ? "Descending" : "Ascending";
  return context === "tonal" ? `${shape} interval, in key` : `${shape} interval`;
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

  const answersDisabled = !hasPlayed || phase !== "answering";

  return (
    <div className="training">
      <p className="mode-label">{modeLabel(question.id.mode, question.id.direction, question.id.context)}</p>

      {question.kind === "contrast" && (
        <p className="prompt">
          Two intervals, same starting note. Which one was the{" "}
          <strong>{getInterval(question.targetSemitones).shortName}</strong>?
        </p>
      )}

      <div className="play-row">
        <button className="btn btn-primary" onClick={handlePlay} disabled={playing}>
          {playing ? "Playing…" : "▶ Play"}
        </button>
        <button className="btn" onClick={handlePlay} disabled={!hasPlayed || playing}>
          ↻ Replay
        </button>
      </div>

      <div className="choices">
        {question.kind === "contrast"
          ? ([1, 2] as const).map((position) => (
              <button
                key={position}
                className="btn choice"
                disabled={answersDisabled}
                onClick={() => chooseAnswer(position)}
              >
                {position === 1 ? "First" : "Second"}
              </button>
            ))
          : question.choices.map((choice) => (
              <button
                key={choice.semitones}
                className="btn choice"
                disabled={answersDisabled}
                onClick={() => chooseAnswer(choice.semitones)}
              >
                {choice.label}
              </button>
            ))}
      </div>

      {feedback && (
        <div className={`feedback ${feedback.correct ? "feedback-correct" : "feedback-incorrect"}`}>
          <p>{feedback.message}</p>
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
