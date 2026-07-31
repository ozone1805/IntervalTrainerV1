import { useState } from "react";
import { ProgressScreen } from "./screens/ProgressScreen";
import { TrainingScreen } from "./screens/TrainingScreen";
import { useLearningEngine } from "./state/useLearningEngine";

type Tab = "train" | "progress";

export default function App() {
  const engine = useLearningEngine();
  const [tab, setTab] = useState<Tab>("train");

  return (
    <div className="app">
      <header className="app-header">
        <h1>Interval Trainer</h1>
        <nav className="tabs">
          <button className={`tab ${tab === "train" ? "tab-active" : ""}`} onClick={() => setTab("train")}>
            Train
          </button>
          <button className={`tab ${tab === "progress" ? "tab-active" : ""}`} onClick={() => setTab("progress")}>
            Progress
          </button>
        </nav>
      </header>

      <main>
        {engine.loading || !engine.progress ? (
          <p className="empty">Loading…</p>
        ) : tab === "train" ? (
          <TrainingScreen engine={engine} />
        ) : (
          <ProgressScreen progress={engine.progress} onReset={engine.resetProgress} />
        )}
      </main>
    </div>
  );
}
