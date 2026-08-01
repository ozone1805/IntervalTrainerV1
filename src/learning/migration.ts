import { skillKey, STATE_VERSION, type EngineState, type IntervalSkill } from "./types";

/**
 * Bring a persisted state blob up to the current shape.
 *
 * Version 0 (unversioned) predates the tonal-context dimension: skills were
 * keyed `semitones:mode:direction` and every question was a bare dyad. Those
 * skills are exactly today's "isolated" skills, so they migrate by re-keying
 * rather than being discarded — otherwise a returning user's whole history
 * would silently orphan and every interval would look brand new again.
 */
export function migrateState(raw: unknown): EngineState | null {
  if (!raw || typeof raw !== "object") return null;
  const state = raw as EngineState;
  if (state.version === STATE_VERSION) return state;

  const skills: Record<string, IntervalSkill> = {};
  for (const skill of Object.values(state.skills ?? {})) {
    const id = { ...skill.id, context: skill.id.context ?? ("isolated" as const) };
    const key = skillKey(id);
    skills[key] = { ...skill, id, key };
  }

  return {
    ...state,
    version: STATE_VERSION,
    meta: { ...state.meta, contextStage: state.meta?.contextStage ?? 0 },
    skills,
    confusion: state.confusion ?? {},
    reviewEvents: state.reviewEvents ?? [],
    // A blocked burst from a previous version has no meaning under the new keys.
    session: undefined,
  };
}
