# Adaptive Ear Trainer — MVP Product Specification

## 1. Product Vision

Build an adaptive ear training application focused on interval recognition.

The goal is not simply to memorize intervals. The goal is to improve the user's ability to **discriminate, recognize, and generalize intervals across different musical contexts**.

The learning system should be inspired by Anki's spaced repetition but modified for ear training.

Unlike vocabulary flashcards, intervals are not independent concepts. As new intervals are introduced, users may temporarily become confused between previously learned intervals. The system must account for:

* forgetting over time
* confusion between similar intervals
* differences between ascending, descending, and harmonic recognition
* gradual introduction of new concepts

The app should feel like a personal ear-training teacher that understands what the user struggles with.

---

# 2. MVP Platform

## Deployment Target

The MVP will be a web application.

Technology:

* React
* TypeScript
* Vite
* Web Audio API / Tone.js
* Local browser storage (IndexedDB)

The app should run in:

* Chrome
* Safari
* Firefox
* Edge

The MVP should be deployable through:

* GitHub repository
* Vercel hosting

No mobile app is required for v1.

---

# 3. Audio Design

## Instrument

The MVP will use only one instrument:

* piano

No additional instruments, synthesizers, or timbres.

Reason:
The MVP should isolate interval recognition rather than test timbre recognition.

## Audio Requirements

The app should:

* generate or play piano interval examples
* maintain consistent volume
* support:

  * ascending intervals
  * descending intervals
  * harmonic intervals
* allow replay before answering

---

# 4. Learning Model

The app uses an Adaptive Learning Engine.

The engine has four responsibilities:

## A. Spaced Repetition

Inspired by Anki.

The system schedules future reviews based on performance.

Track:

* review history
* success rate
* ease
* interval between reviews
* next review date
* lapses

States:

* New
* Learning
* Review
* Relearning

---

## B. Interval Mastery

The system tracks mastery separately for each interval.

Example:

```
Perfect Fourth:
Mastery: 85%

Perfect Fifth:
Mastery: 92%

Major Third:
Mastery: 63%
```

Mastery should increase with correct answers and decrease with repeated failures.

---

## C. Confusion Tracking

The system must track incorrect answers, not just correct answers.

Example:

User hears:

Correct:
Perfect Fourth

Answers:
Perfect Fifth

The system records:

```
P4 → P5 confusion +1
```

Over time, create a confusion matrix:

```
            Mistaken As

        P5    M3    m3

P4      18     3     1

P5      15     2     0

M3       4     9     6
```

The scheduler should use this information.

If a user confuses two intervals frequently, the app should intentionally practice those distinctions.

---

## D. Generalization Tracking

Track performance across:

* interval
* direction
* harmonic vs melodic

Example:

A user may know:

```
Ascending P5:
90%

Descending P5:
65%

Harmonic P5:
50%
```

The app should recognize that these are different skills.

---

# 5. Adaptive Exercise Generation

The app should not use a fixed flashcard deck.

Instead:

The scheduler chooses what exercise is most valuable next.

A question is generated dynamically based on:

* due reviews
* weak intervals
* confusion pairs
* recent mistakes
* learning stage

Examples:

If user knows P4 but confuses it with P5:

Generate:

```
Hear interval:

?

Choices:

P4
P5
```

If user struggles with harmonic intervals:

Generate:

```
Harmonic P4 vs P5 exercises
```

---

# 6. Progressive Learning System

The app should introduce concepts gradually.

Initial example:

Stage 1:

```
Perfect Fourth
Perfect Fifth
```

Stage 2:

```
Add Major Third
```

Stage 3:

```
Add Minor Third
```

Stage 4:

```
Expand interval vocabulary
```

When new intervals are introduced:

* previously learned intervals should continue appearing
* confusion should be monitored
* temporary drops in accuracy should not be interpreted as forgetting

The system should distinguish:

"I forgot this"

from

"I know this but it is competing with a new concept."

---

# 7. Review Grades

After answering, the user provides a confidence grade:

## Again

User did not know.

Effects:

* review sooner
* reduce mastery
* increase priority

## Hard

User struggled.

Effects:

* smaller interval increase
* slight mastery reduction

## Good

Correct and comfortable.

Effects:

* normal interval increase

## Easy

Immediate recognition.

Effects:

* larger interval increase

---

# 8. Session Algorithm

Each session:

1. Load due exercises.
2. Identify weak areas.
3. Identify confusion pairs.
4. Generate a balanced set of questions.
5. Present questions.
6. Record answers.
7. Update:

   * mastery
   * confusion matrix
   * scheduling data
8. Generate the next session plan.

---

# 9. Data Model

## User

```
id
createdAt
totalReviews
streak
```

## IntervalSkill

Represents knowledge of an interval.

```
interval
direction
mode
mastery
easeFactor
reviewInterval
nextReview
lastReviewed
correctCount
incorrectCount
```

Examples:

```
P4 + Ascending + Melodic

P5 + Harmonic
```

---

## ConfusionRecord

```
correctInterval
incorrectAnswer
count
lastOccurred
```

Example:

```
P4 → P5
count: 18
```

---

## ReviewEvent

```
timestamp
interval
direction
mode
correctAnswer
userAnswer
grade
responseTime
```

---

# 10. UI Requirements

## Training Screen

Must include:

* Play button
* Replay button
* Answer choices
* Feedback
* Next question button

Minimal, clean design.

---

## Progress Screen

Show:

* overall accuracy
* strongest intervals
* weakest intervals
* common confusions
* reviews completed

---

# 11. MVP Definition of Done

The MVP is complete when:

A user can:

1. Open the web app.
2. Hear a piano interval.
3. Identify the interval.
4. Receive feedback.
5. Have the system remember performance.
6. Return later and receive personalized exercises.
7. Experience more practice on weak/confused areas.
8. Improve through adaptive review.

---

# 12. Development Priorities

Build in this order:

## Phase 1

Project setup:

* React
* TypeScript
* Vite
* basic UI

## Phase 2

Audio engine:

* piano playback
* interval generation

## Phase 3

Quiz engine:

* questions
* answers
* feedback

## Phase 4

Adaptive Learning Engine:

* mastery
* spaced repetition
* confusion tracking

## Phase 5

Persistence:

* IndexedDB storage

## Phase 6

Deployment:

* GitHub
* Vercel

---

# Future Features (Not MVP)

Possible future additions:

* user accounts
* cloud sync
* mobile app
* chord recognition
* melodic dictation
* rhythm training
* multiple instruments
* teacher/class mode
* AI-generated lesson plans

---

## Claude Code Instructions

Prioritize:

* clean architecture
* modular code
* readable scheduling logic
* testable algorithms
* separation between UI, audio, and learning logic

Do not over-engineer the MVP.

The most important part of this project is the Adaptive Learning Engine.
