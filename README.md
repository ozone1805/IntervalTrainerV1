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

## Installable app (PWA)

The build is an installable Progressive Web App, so it can be shared as a plain link and added to
a phone's home screen — no app store, no accounts. Progress stays per-device: IndexedDB with no
sync, so each person who opens the link gets their own independent history.

- `public/manifest.webmanifest` + `public/icon-*.png` — name, colours, and icons for installation.
- `public/sw.js` — the offline shell. Precaches the app and every piano sample on install,
  serves navigations network-first (so a new deploy lands as soon as there is a connection) and
  everything else cache-first. It ships with placeholder tokens that
  `scripts/inject-sw-manifest.mjs` rewrites after each build with the content-hashed filenames.
- `src/pwa/` — service worker registration (production only) and the iOS/standalone detection the
  install and audio hints depend on.

Two platform facts shape the UI:

- **iOS cannot be prompted to install.** There is no API, so `InstallBanner` falls back to telling
  the user which Safari menu items to tap. Chrome gets a real `beforeinstallprompt` button.
- **The iPhone ring/silent switch mutes Web Audio**, silently and undetectably. For an ear trainer
  that reads as a broken app, so `RingerHint` warns about it before the first play.

Piano samples are vendored into `public/audio/salamander/` rather than streamed from the Tone.js
CDN. `Tone.Sampler` blocks the first note until every sample has loaded, so the set is trimmed to
the C2–C6 the trainer can actually sound — 17 files, ~1.2 MB, at Salamander's native minor-third
spacing.

## Deployment

Deployed to GitHub Pages at **https://ozone1805.github.io/IntervalTrainerV1/**, served from the
`gh-pages` branch.

```bash
npm run deploy    # build, then push dist/ to the gh-pages branch
```

`scripts/deploy-gh-pages.mjs` publishes through a temporary git worktree, since `dist/` is
gitignored on the source branch and so has no history for `git subtree` to split off. The branch is
a single rolling commit of build output.

Because the site is served from a repo subpath, `base` in `vite.config.ts` must stay in sync with
the repo name; moving to a root-served host means clearing it.
