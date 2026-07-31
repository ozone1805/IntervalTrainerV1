import type { ProgressSummary } from "../learning/engine";

export function ProgressScreen({
  progress,
  onReset,
}: {
  progress: ProgressSummary;
  onReset: () => void;
}) {
  const handleReset = () => {
    if (window.confirm("Reset all progress? This clears your curriculum stage, mastery, and history.")) {
      onReset();
    }
  };

  return (
    <div className="progress">
      <div className="stat-grid">
        <Stat label="Reviews completed" value={String(progress.totalReviews)} />
        <Stat label="Day streak" value={String(progress.streak)} />
        <Stat
          label="Overall accuracy"
          value={progress.overallAccuracy === null ? "—" : `${Math.round(progress.overallAccuracy * 100)}%`}
        />
        <Stat label="Curriculum stage" value={String(progress.curriculumStage + 1)} />
      </div>

      <section>
        <h2>Strongest intervals</h2>
        {progress.strongest.length === 0 ? (
          <p className="empty">Not enough data yet.</p>
        ) : (
          <ul className="mastery-list">
            {progress.strongest.map((s) => (
              <li key={s.label}>
                <span>{s.label}</span>
                <MasteryBar value={s.mastery} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Weakest intervals</h2>
        {progress.weakest.length === 0 ? (
          <p className="empty">Not enough data yet.</p>
        ) : (
          <ul className="mastery-list">
            {progress.weakest.map((s) => (
              <li key={s.label}>
                <span>{s.label}</span>
                <MasteryBar value={s.mastery} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Common confusions</h2>
        {progress.topConfusions.length === 0 ? (
          <p className="empty">No confusions recorded yet.</p>
        ) : (
          <ul className="confusion-list">
            {progress.topConfusions.map((c, i) => (
              <li key={i}>
                <span>
                  {c.correct} → mistaken for {c.mistakenAs}
                </span>
                <span className="confusion-count">{c.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="btn reset-btn" onClick={handleReset}>
        Reset progress
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function MasteryBar({ value }: { value: number }) {
  return (
    <div className="mastery-bar">
      <div className="mastery-bar-fill" style={{ width: `${value}%` }} />
    </div>
  );
}
