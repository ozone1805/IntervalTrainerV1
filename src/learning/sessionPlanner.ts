import {
  contextualRootMidi,
  getInterval,
  INTERVALS,
  randomKeyRootMidi,
  randomRootMidi,
} from "../music/intervals";
import { confusionScoreFor, topConfusionsFor } from "./confusion";
import {
  skillKey,
  type ConfusionRecord,
  type EngineState,
  type IntervalSkill,
  type Question,
  type SessionPlan,
  type SkillId,
} from "./types";

const CHOICES_PER_QUESTION = 4;

/**
 * How many times in a row a freshly introduced skill is repeated. Blocked
 * practice is the right shape for a brand new item — it establishes what the
 * thing sounds like; interleaving pays off later, once it has to be told apart
 * from its neighbours.
 */
export const INTRO_BLOCK_SIZE = 3;

interface Candidate {
  id: SkillId;
  skill: IntervalSkill | null; // null means not yet introduced ("new")
}

export interface SkillChoice {
  id: SkillId;
  session: SessionPlan | undefined;
}

function overdueMinutes(skill: IntervalSkill, now: number): number {
  return Math.max(0, (now - skill.nextReview) / 60000);
}

/**
 * Drop whichever skill was just asked, keeping it only if it is genuinely the
 * last resort. Two identical questions back to back read as the app being
 * stuck — the exception being a blocked introduction, which is deliberately
 * repetitive and skips this.
 */
function excludingLast<T extends { id: SkillId }>(candidates: T[], lastKey: string | undefined): T[] {
  if (!lastKey || candidates.length < 2) return candidates;
  const rest = candidates.filter((c) => skillKey(c.id) !== lastKey);
  return rest.length > 0 ? rest : candidates;
}

function pickRootMidi(id: SkillId, keyRootMidi: number, rng: () => number): number {
  return id.context === "tonal"
    ? contextualRootMidi(id.semitones, id.direction, keyRootMidi, rng)
    : randomRootMidi(rng);
}

/**
 * Choose which skill to test next. Priority order:
 * 1. Continue an open blocked burst of a newly introduced skill.
 * 2. Reviews that are due, weighted toward ones the user confuses often and
 *    ones that are most overdue.
 * 3. Introduce the next not-yet-seen skill from the curriculum, opening a
 *    blocked burst so it gets a few consecutive hearings.
 * 4. Otherwise, reinforce whichever unlocked skill has the lowest mastery.
 */
export function chooseNextSkill(
  state: EngineState,
  unlockedIds: SkillId[],
  now: number,
  rng: () => number = Math.random,
): SkillChoice {
  const candidates: Candidate[] = unlockedIds.map((id) => ({
    id,
    skill: state.skills[skillKey(id)] ?? null,
  }));

  const block = state.session;
  if (block && block.blockRemaining > 0) {
    const blocked = candidates.find((c) => skillKey(c.id) === block.blockSkillKey);
    if (blocked) {
      const blockRemaining = block.blockRemaining - 1;
      return {
        id: blocked.id,
        session: blockRemaining > 0 ? { ...block, blockRemaining } : undefined,
      };
    }
  }

  const lastKey = state.reviewEvents[state.reviewEvents.length - 1]?.skillKey;

  // The skill just asked is never re-served from here, even when it is the
  // only thing due. Learning steps are measured in minutes, so a skill the
  // user keeps getting wrong comes due again immediately and would otherwise
  // monopolize the session — the user drills one interval over and over while
  // the rest of the stage is never even introduced.
  const due = candidates.filter(
    (c) => c.skill && c.skill.nextReview <= now && skillKey(c.id) !== lastKey,
  ) as Array<{
    id: SkillId;
    skill: IntervalSkill;
  }>;

  if (due.length > 0) {
    const scored = due.map((c) => ({
      c,
      score: confusionScoreFor(state.confusion, c.id.semitones) * 5 + overdueMinutes(c.skill, now),
    }));
    scored.sort((a, b) => b.score - a.score);
    // Weighted pick among the top few so it isn't perfectly deterministic.
    const pool = scored.slice(0, Math.min(3, scored.length));
    const pick = pool[Math.floor(rng() * pool.length)];
    return { id: pick.c.id, session: undefined };
  }

  const unintroduced = candidates.filter((c) => c.skill === null);
  if (unintroduced.length > 0) {
    const id = unintroduced[Math.floor(rng() * unintroduced.length)].id;
    // This question is the first of the burst, so the rest are what remain.
    return {
      id,
      session: { blockSkillKey: skillKey(id), blockRemaining: INTRO_BLOCK_SIZE - 1 },
    };
  }

  const known = excludingLast(candidates as Array<{ id: SkillId; skill: IntervalSkill }>, lastKey);
  const sorted = [...known].sort((a, b) => a.skill.mastery - b.skill.mastery);
  const pool = sorted.slice(0, Math.min(3, sorted.length));
  return { id: pool[Math.floor(rng() * pool.length)].id, session: undefined };
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
  const keyRootMidi = randomKeyRootMidi(rng);

  return {
    skillKey: skillKey(id),
    id,
    rootMidi: pickRootMidi(id, keyRootMidi, rng),
    keyRootMidi,
    choices,
    createdAt: now,
  };
}

/** Pick the next skill to test and build a question for it. */
export function planQuestion(
  state: EngineState,
  unlockedIds: SkillId[],
  unlockedSemitones: number[],
  now: number,
  rng: () => number = Math.random,
): { question: Question; session: SessionPlan | undefined } {
  const { id, session } = chooseNextSkill(state, unlockedIds, now, rng);
  return { question: buildQuestion(id, unlockedSemitones, state.confusion, now, rng), session };
}

export function allIntervalShortNames(): string[] {
  return INTERVALS.map((i) => i.shortName);
}
