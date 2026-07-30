import * as Tone from "tone";
import { midiToNoteName, type Direction, type PlaybackMode } from "../music/intervals";

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

  async playInterval(rootMidi: number, semitones: number, mode: PlaybackMode, direction: Direction | null): Promise<void> {
    await this.ensureReady();
    const sampler = this.sampler;
    if (!sampler) return;

    const secondMidi = direction === "down" ? rootMidi - semitones : rootMidi + semitones;
    const rootNote = midiToNoteName(rootMidi);
    const secondNote = midiToNoteName(secondMidi);

    const now = Tone.now();
    if (mode === "harmonic") {
      sampler.triggerAttackRelease([rootNote, secondNote], NOTE_DURATION_SECONDS, now);
      return;
    }

    // Melodic: for "down" we still play root-then-target in the order the
    // ear should hear them, i.e. the actual first note is `rootMidi` and the
    // second is `secondMidi`, regardless of which is numerically higher.
    sampler.triggerAttackRelease(rootNote, NOTE_DURATION_SECONDS, now);
    sampler.triggerAttackRelease(secondNote, NOTE_DURATION_SECONDS, now + MELODIC_GAP_SECONDS);
  }
}

export const pianoEngine = new PianoEngine();
