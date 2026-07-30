/**
 * The fixed catalog of musical intervals the trainer knows about.
 * `semitones` is the canonical identity of an interval (1-12); everything
 * else (mastery, scheduling, mode) is layered on top of this in the
 * learning engine.
 */
export interface IntervalDef {
  semitones: number;
  name: string;
  shortName: string;
}

export const INTERVALS: IntervalDef[] = [
  { semitones: 1, name: "Minor 2nd", shortName: "m2" },
  { semitones: 2, name: "Major 2nd", shortName: "M2" },
  { semitones: 3, name: "Minor 3rd", shortName: "m3" },
  { semitones: 4, name: "Major 3rd", shortName: "M3" },
  { semitones: 5, name: "Perfect 4th", shortName: "P4" },
  { semitones: 6, name: "Tritone", shortName: "TT" },
  { semitones: 7, name: "Perfect 5th", shortName: "P5" },
  { semitones: 8, name: "Minor 6th", shortName: "m6" },
  { semitones: 9, name: "Major 6th", shortName: "M6" },
  { semitones: 10, name: "Minor 7th", shortName: "m7" },
  { semitones: 11, name: "Major 7th", shortName: "M7" },
  { semitones: 12, name: "Octave", shortName: "P8" },
];

const BY_SEMITONES = new Map(INTERVALS.map((i) => [i.semitones, i]));

export function getInterval(semitones: number): IntervalDef {
  const found = BY_SEMITONES.get(semitones);
  if (!found) throw new Error(`Unknown interval: ${semitones} semitones`);
  return found;
}

export type Direction = "up" | "down";
export type PlaybackMode = "melodic" | "harmonic";

/** Note names for converting a MIDI number to a display/audio note string. */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}

/** Safe range for the root note so both notes of any interval stay within sampled piano range. */
export const ROOT_MIDI_MIN = 48; // C3
export const ROOT_MIDI_MAX = 72; // C5

export function randomRootMidi(rng: () => number = Math.random): number {
  return ROOT_MIDI_MIN + Math.floor(rng() * (ROOT_MIDI_MAX - ROOT_MIDI_MIN + 1));
}
