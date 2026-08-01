# Interval Trainer

An adaptive ear-training web app for interval recognition, per `spec.md`.

## Stack

React + TypeScript + Vite, Tone.js (piano samples), IndexedDB for local persistence.

## Architecture

- `src/music/` — interval catalog and note/MIDI utilities. No dependencies on anything else.
- `src/learning/` — the Adaptive Learning Engine. Pure, framework-free, unit-tested:
  - `types.ts` — shared data model (skills, confusion records, review events, questions)
  - `curriculum.ts` — progressive interval/mode/context unlocking
  - `mastery.ts` — mastery scoring
  - `spacedRepetition.ts` — Anki-style SM-2 scheduler
  - `confusion.ts` — confusion matrix tracking and contrast-pair selection
  - `sessionPlanner.ts` — picks the next skill and decides how to present it
  - `migration.ts` — forward migration of persisted state between versions
  - `engine.ts` — `LearningEngine` facade that orchestrates the above
- `src/audio/` — Tone.js piano sampler wrapper, isolated from learning logic.
- `src/storage/` — IndexedDB persistence for engine state.
- `src/state/` — React hook wiring the engine, storage, and audio together.
- `src/screens/` — Training and Progress screens.

The engine has no knowledge of React, audio, or storage, so its scheduling/mastery/confusion
logic can be revised independently and is covered by unit tests in `src/learning/*.test.ts`.

## How the scheduling works

A **skill** is one (interval, mode, direction, context) combination, tracked independently — the
spec's generalization model. Three ladders unlock in sequence: intervals (P4/P5 → +M3 → +m3 → …),
then modes (ascending → +descending → +harmonic), then tonal context.

Two ideas from the learning-science literature shape how questions are chosen, beyond plain SM-2:

- **Contrast trials.** Spacing two confusable items apart in time does not teach the distinction
  between them; juxtaposing them does (the discriminative-contrast effect — Kornell & Bjork 2008,
  and Kang & Pashler 2012, where interleaving helped but temporal spacing alone did not). Once a
  pair is muddled often enough, it is sometimes served as an A/B trial that plays both intervals
  back to back over the same root. Confusion is counted symmetrically, since mixing up P4 and P5 in
  both directions is one confusion, not two mild ones.
- **Blocked introduction.** Interleaving pays off for confusable items, but blocking is better for
  establishing a brand new one, so a freshly unlocked skill gets a short consecutive burst before
  entering the mix.

- **Tonal context** is the last ladder because isolated interval identification transfers poorly to
  real musical listening — skilled listeners hear scale degrees against a tonic (Karpinski, *Aural
  Skills Acquisition*). Tonal questions play a I–V–I cadence first and pick a root that keeps both
  notes in the key where possible.

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
