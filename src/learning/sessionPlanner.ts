import { getInterval, INTERVALS, randomRootMidi } from "../music/intervals";
import { confusionScoreFor, topConfusionsFor } from "./confusion";
import { skillKey, type ConfusionRecord, type EngineState, type IntervalSkill, type Question, type SkillId } from "./types";

const CHOICES_PER_QUESTION = 4;

interface Candidate {
  id: SkillId;
  skill: IntervalSkill | null; // null means not yet introduced ("new")
}

function overdueMinutes(skill: IntervalSkill, now: number): number {
  return Math.max(0, (now - skill.nextReview) / 60000);
}

/**
 * Choose which skill to test next. Priority order:
 * 1. Reviews that are due, weighted toward ones the user confuses often and
 *    ones that are most overdue.
 * 2. Introduce the next not-yet-seen skill from the curriculum, if any are
 *    unlocked but untouched.
 * 3. Otherwise, reinforce whichever unlocked skill has the lowest mastery.
 */
export function chooseNextSkill(
  state: EngineState,
  unlockedIds: SkillId[],
  now: number,
  rng: () => number = Math.random,
): SkillId {
  const candidates: Candidate[] = unlockedIds.map((id) => ({
    id,
    skill: state.skills[skillKey(id)] ?? null,
  }));

  const due = candidates.filter((c) => c.skill && c.skill.nextReview <= now) as Array<{ id: SkillId; skill: IntervalSkill }>;

  if (due.length > 0) {
    const scored = due.map((c) => ({
      c,
      score: confusionScoreFor(state.confusion, c.id.semitones) * 5 + overdueMinutes(c.skill, now),
    }));
    scored.sort((a, b) => b.score - a.score);
    // Weighted pick among the top few so it isn't perfectly deterministic.
    const pool = scored.slice(0, Math.min(3, scored.length));
    const pick = pool[Math.floor(rng() * pool.length)];
    return pick.c.id;
  }

  const unintroduced = candidates.filter((c) => c.skill === null);
  if (unintroduced.length > 0) {
    return unintroduced[Math.floor(rng() * unintroduced.length)].id;
  }

  const known = candidates as Array<{ id: SkillId; skill: IntervalSkill }>;
  const sorted = [...known].sort((a, b) => a.skill.mastery - b.skill.mastery);
  const pool = sorted.slice(0, Math.min(3, sorted.length));
  return pool[Math.floor(rng() * pool.length)].id;
}

/**
 * Build a multiple-choice question for `id`, picking distractors that
 * prioritize known confusions, then nearby unlocked intervals, then any
 * unlocked interval.
 */
export function buildQuestion(
  id: SkillId,
  unlockedSemitones: number[],
  confusion: Record<string, ConfusionRecord>,
  now: number,
  rng: () => number = Math.random,
): Question {
  const others = unlockedSemitones.filter((s) => s !== id.semitones);
  const distractors: number[] = [];

  const confused = topConfusionsFor(confusion, id.semitones, others.length).map((c) => c.incorrectSemitones);
  for (const s of confused) {
    if (distractors.length >= CHOICES_PER_QUESTION - 1) break;
    if (others.includes(s) && !distractors.includes(s)) distractors.push(s);
  }

  const byDistance = [...others]
    .filter((s) => !distractors.includes(s))
    .sort((a, b) => Math.abs(a - id.semitones) - Math.abs(b - id.semitones));
  for (const s of byDistance) {
    if (distractors.length >= CHOICES_PER_QUESTION - 1) break;
    distractors.push(s);
  }

  // Shuffle so distance-based picks aren't always adjacent in the list, then
  // build final choice list including the correct answer.
  for (let i = distractors.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
  }

  const choiceSemitones = [id.semitones, ...distractors.slice(0, CHOICES_PER_QUESTION - 1)];
  for (let i = choiceSemitones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choiceSemitones[i], choiceSemitones[j]] = [choiceSemitones[j], choiceSemitones[i]];
  }

  const choices = choiceSemitones.map((s) => ({ semitones: s, label: getInterval(s).shortName }));

  return {
    skillKey: skillKey(id),
    id,
    rootMidi: randomRootMidi(rng),
    choices,
    createdAt: now,
  };
}

export function allIntervalShortNames(): string[] {
  return INTERVALS.map((i) => i.shortName);
}
