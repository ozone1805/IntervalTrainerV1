import * as Tone from "tone";
import {
  midiToNoteName,
  secondNoteMidi,
  type Direction,
  type PlaybackMode,
  type ToneContext,
} from "../music/intervals";

const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

const SAMPLE_URLS: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

const NOTE_DURATION_SECONDS = 0.9;
const MELODIC_GAP_SECONDS = 0.55;

/** Long enough that the two halves of a contrast trial read as separate items. */
const CONTRAST_GAP_SECONDS = 1.4;

/** I–V–I, as semitone offsets from the key's tonic. */
const CADENCE_CHORDS = [
  [0, 4, 7],
  [7, 11, 14],
  [0, 4, 7],
];
const CADENCE_CHORD_SECONDS = 0.5;
const CADENCE_TAIL_SECONDS = 0.45;

/**
 * Thin wrapper around a Tone.js sampled piano. Kept isolated from the
 * learning engine and UI: it only knows how to turn (root note, semitone
 * offset, mode/direction) into sound.
 */
export class PianoEngine {
  private sampler: Tone.Sampler | null = null;
  private loadPromise: Promise<void> | null = null;

  /** Must be called from a user gesture handler before any playback. */
  async ensureReady(): Promise<void> {
    await Tone.start();
    if (!this.sampler) {
      this.loadPromise = new Promise((resolve) => {
        this.sampler = new Tone.Sampler({
          urls: SAMPLE_URLS,
          baseUrl: SALAMANDER_BASE_URL,
          release: 1,
          onload: () => resolve(),
        }).toDestination();
      });
    }
    await this.loadPromise;
  }

  /**
   * Play a I–V–I cadence to plant a tonic before the interval itself, and
   * return how long it takes so the caller can schedule what follows.
   */
  private scheduleCadence(sampler: Tone.Sampler, keyRootMidi: number, at: number): number {
    CADENCE_CHORDS.forEach((offsets, i) => {
      const notes = offsets.map((o) => midiToNoteName(keyRootMidi + o));
      sampler.triggerAttackRelease(notes, CADENCE_CHORD_SECONDS, at + i * CADENCE_CHORD_SECONDS);
    });
    return CADENCE_CHORDS.length * CADENCE_CHORD_SECONDS + CADENCE_TAIL_SECONDS;
  }

  /** Schedule one interval, returning how long it occupies. */
  private scheduleInterval(
    sampler: Tone.Sampler,
    rootMidi: number,
    semitones: number,
    mode: PlaybackMode,
    direction: Direction | null,
    at: number,
  ): number {
    const rootNote = midiToNoteName(rootMidi);
    const secondNote = midiToNoteName(secondNoteMidi(rootMidi, semitones, direction));

    if (mode === "harmonic") {
      sampler.triggerAttackRelease([rootNote, secondNote], NOTE_DURATION_SECONDS, at);
      return NOTE_DURATION_SECONDS;
    }

    // Melodic: for "down" we still play root-then-target in the order the
    // ear should hear them, i.e. the actual first note is `rootMidi` and the
    // second is `secondMidi`, regardless of which is numerically higher.
    sampler.triggerAttackRelease(rootNote, NOTE_DURATION_SECONDS, at);
    sampler.triggerAttackRelease(secondNote, NOTE_DURATION_SECONDS, at + MELODIC_GAP_SECONDS);
    return MELODIC_GAP_SECONDS + NOTE_DURATION_SECONDS;
  }

  async playInterval(
    rootMidi: number,
    semitones: number,
    mode: PlaybackMode,
    direction: Direction | null,
    context: ToneContext = "isolated",
    keyRootMidi?: number,
  ): Promise<void> {
    await this.ensureReady();
    const sampler = this.sampler;
    if (!sampler) return;

    let at = Tone.now();
    if (context === "tonal" && keyRootMidi !== undefined) {
      at += this.scheduleCadence(sampler, keyRootMidi, at);
    }
    this.scheduleInterval(sampler, rootMidi, semitones, mode, direction, at);
  }

  /**
   * Play two intervals back to back over the same root. Sharing the root is
   * the point: it leaves the distance between the notes as the only thing
   * that differs, which is what makes the pair discriminable.
   */
  async playContrast(
    rootMidi: number,
    firstSemitones: number,
    secondSemitones: number,
    mode: PlaybackMode,
    direction: Direction | null,
    context: ToneContext = "isolated",
    keyRootMidi?: number,
  ): Promise<void> {
    await this.ensureReady();
    const sampler = this.sampler;
    if (!sampler) return;

    let at = Tone.now();
    if (context === "tonal" && keyRootMidi !== undefined) {
      at += this.scheduleCadence(sampler, keyRootMidi, at);
    }

    const firstLength = this.scheduleInterval(sampler, rootMidi, firstSemitones, mode, direction, at);
    this.scheduleInterval(
      sampler,
      rootMidi,
      secondSemitones,
      mode,
      direction,
      at + firstLength + CONTRAST_GAP_SECONDS,
    );
  }
}

export const pianoEngine = new PianoEngine();
