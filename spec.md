## Adaptive Direction Learning

The app should not treat ascending, descending, and harmonic intervals as three fixed modes that are simply mixed randomly. Instead, it should **teach them progressively and adaptively**.

### Core Idea

The system should:

1. Introduce one mode at a time or in a controlled blend.
2. Observe how the user performs in each mode.
3. Use that performance to decide what to test next.
4. Prioritize weaker modes and interval types more often.
5. Continue reshaping the mix over time so the user gets the right kind of challenge.

### Mode Learning Model

Track performance separately for:

* ascending melodic intervals
* descending melodic intervals
* harmonic intervals

For each mode, store:

* accuracy
* recent accuracy
* response time
* lapse count
* confidence / mastery score
* last seen date
* next scheduled review date

### Introduction Strategy

At the beginning, the app should not overwhelm the user with all three modes at once. It should start with a controlled introduction such as:

* begin with one primary mode
* introduce a second mode once the first is reasonably stable
* introduce the third mode later
* keep reviewing older modes so they do not decay

This can be configured, but the default behavior should feel like a guided progression rather than a random mixture.

### Adaptive Testing

The app should choose the next question based on what it knows about the user.

Examples:

* If the user is strong at ascending but weak at descending, show more descending questions.
* If harmonic intervals are consistently missed, schedule them sooner and more often.
* If the user is doing well in all modes, broaden the mix and increase spacing.
* If the user is confused between two modes, deliberately contrast them more often.

### Question Selection Logic

When generating a session, the app should weigh each candidate question by:

* mode mastery
* interval difficulty
* recent misses
* total review history
* whether the user has recently seen that exact mode/interval combination

The system should not just ask “the next interval.” It should ask the next interval that is most useful for learning.

### Progressive Exposure

The app should gradually shift from:

* more guided practice
  to
* more mixed practice
  to
* more exam-like testing

A good default progression is:

1. isolated mode practice
2. mixed but weighted mode practice
3. mostly mixed review with targeted weak spots
4. periodic assessment sessions

### Mastery Thresholds

A mode should only be considered “strong” when the user has shown consistent success across multiple sessions, not just one lucky streak.

For example:

* a mode becomes “stable” after several correct answers in recent reviews
* a mode becomes “weak” again after repeated misses or long time away
* a mode can move up or down in priority based on recent behavior

### Desired User Experience

The experience should feel like:

* “The app is teaching me these directions in a smart order.”
* “It notices what I miss.”
* “It keeps coming back to the things I actually need.”
* “It does not waste my time on stuff I already know.”

## Updated MVP Requirement

The first version should include:

* separate tracking for ascending, descending, and harmonic performance
* adaptive selection of the next mode based on user history
* progressive introduction of modes
* spaced repetition that operates within each mode
* mixed review that gets smarter over time

