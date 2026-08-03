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
  - `confusion.ts` — confusion matrix tracking, used to prioritize reviews and pick distractors
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

Every question is the same shape: hear one interval, name it from four choices. Three further
ideas shape how those questions are chosen and presented, beyond plain SM-2:

- **Confusion-driven distractors.** The intervals a target is most often mistaken for are the ones
  offered alongside it, so the choice list keeps posing the distinction the user actually finds
  hard rather than an easy one.
- **Blocked introduction.** Interleaving pays off for confusable items, but blocking is better for
  establishing a brand new one, so a freshly unlocked skill gets a short consecutive burst before
  entering the mix.
- **Retry instead of reveal.** A wrong answer crosses that choice off and lets the user listen
  again and pick again, rather than ending the question with the answer. Only the first attempt is
  graded — a retry cannot earn back the review — but each wrong guess still feeds the confusion
  matrix.
- **Pace that follows the user.** Every ladder is gated on average mastery plus a floor on how many
  times each skill has been reviewed. Those gates shrink as `meta.answerStreak` — consecutive
  first-attempt correct answers — grows, reaching roughly half their normal size at a run of 12.
  Mastery still has to be earned and a single miss resets the run to 0, so this shortens the wait
  without skipping the evidence. A skill that graduates out of the learning steps also satisfies
  the review floor outright: an instantly-recognized interval gets parked on a multi-day SM-2
  interval and stops being offered, so counting raw repetitions would hold the sharpest user back
  the hardest.

Answers are graded on **thinking time only** — the clock starts when the interval has finished
sounding, so a long tonal cadence costs the user nothing and answering before the last note fades
reads as instant recognition. Replaying does not restart it, since needing another listen is
exactly the hesitation the grade is for.

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

Not currently deployed anywhere — development and testing happen locally via `npm run dev`.

`npm run build` produces a self-contained static site in `dist/`, so any static host will serve it
as-is if that changes.
