import { useEffect, useRef, useState } from "react";
import type { Direction, PlaybackMode, ToneContext } from "../music/intervals";
import type { useLearningEngine } from "../state/useLearningEngine";

type Engine = ReturnType<typeof useLearningEngine>;

function modeLabel(mode: PlaybackMode, direction: Direction | null, context: ToneContext): string {
  const shape = mode === "harmonic" ? "Harmonic" : direction === "down" ? "Descending" : "Ascending";
  return context === "tonal" ? `${shape} interval, in key` : `${shape} interval`;
}

export function TrainingScreen({ engine }: { engine: Engine }) {
  const { question, phase, wrongAnswers, feedback, play, chooseAnswer } = engine;
  const [hasPlayed, setHasPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  /**
   * Browsers only let audio start from a user gesture, so the first question
   * of a session has to be played by hand. Every one after that plays itself.
   * A ref rather than state: flipping it must not re-run the effect below and
   * replay the question that just unlocked the audio.
   */
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    setHasPlayed(false);
    if (!question || !audioUnlockedRef.current) return;

    let cancelled = false;
    setPlaying(true);
    void (async () => {
      try {
        await play();
        if (!cancelled) setHasPlayed(true);
      } finally {
        if (!cancelled) setPlaying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [question, play]);

  if (!question) return null;

  const handlePlay = async () => {
    setPlaying(true);
    try {
      await play();
      setHasPlayed(true);
      audioUnlockedRef.current = true;
    } finally {
      setPlaying(false);
    }
  };

  // Once the answer is right the question is over and advances on its own,
  // so the choices lock rather than letting a stray click land on the next one.
  const answersDisabled = !hasPlayed || phase === "correct";

  return (
    <div className="training">
      <p className="mode-label">{modeLabel(question.id.mode, question.id.direction, question.id.context)}</p>

      <div className="play-row">
        <button className="btn btn-primary" onClick={handlePlay} disabled={playing}>
          {playing ? "Playing…" : "▶ Play"}
        </button>
        <button className="btn" onClick={handlePlay} disabled={!hasPlayed || playing}>
          ↻ Replay
        </button>
      </div>

      <div className="choices">
        {question.choices.map((choice) => {
          const eliminated = wrongAnswers.includes(choice.semitones);
          return (
            <button
              key={choice.semitones}
              className={`btn choice${eliminated ? " choice-eliminated" : ""}`}
              disabled={answersDisabled || eliminated}
              onClick={() => chooseAnswer(choice.semitones)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className={`feedback ${feedback.correct ? "feedback-correct" : "feedback-incorrect"}`}>
          <p>{feedback.message}</p>
        </div>
      )}
    </div>
  );
}
