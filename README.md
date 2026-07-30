# Interval Trainer

An adaptive ear-training web app for interval recognition, per `spec.md`.

## Stack

React + TypeScript + Vite, Tone.js (piano samples), IndexedDB for local persistence.

## Architecture

- `src/music/` — interval catalog and note/MIDI utilities. No dependencies on anything else.
- `src/learning/` — the Adaptive Learning Engine. Pure, framework-free, unit-tested:
  - `types.ts` — shared data model (skills, confusion records, review events)
  - `curriculum.ts` — progressive interval/mode unlocking
  - `mastery.ts` — mastery scoring
  - `spacedRepetition.ts` — Anki-style SM-2 scheduler
  - `confusion.ts` — confusion matrix tracking
  - `sessionPlanner.ts` — picks the next skill to test and builds a question
  - `engine.ts` — `LearningEngine` facade that orchestrates the above
- `src/audio/` — Tone.js piano sampler wrapper, isolated from learning logic.
- `src/storage/` — IndexedDB persistence for engine state.
- `src/state/` — React hook wiring the engine, storage, and audio together.
- `src/screens/` — Training and Progress screens.

The engine has no knowledge of React, audio, or storage, so its scheduling/mastery/confusion
logic can be revised independently and is covered by unit tests in `src/learning/*.test.ts`.

## Development

```bash
npm install
npm run dev       # start dev server
npm test          # run learning engine unit tests
npm run build     # typecheck + production build
```

## Deployment

Deploys as a static site (Vite build output in `dist/`) — works out of the box on Vercel:
import this GitHub repo at vercel.com, framework preset "Vite", no environment variables needed.
