// app/src/audio/score.js — the two show scores (original compositions, played by the synth in showMusic.js) and the
// pure choreography that makes the city dance to them: Buckingham's jets and colours, the bridges' gate flashers.
// Chords are MIDI notes, lowest first (the bass plays the lowest note).
import { SHOW_COLOURS } from '../landmarks/fountainSchedule.js'

export const SCORES = {
  // Buckingham Fountain — a lyrical piece in D major for the 20-minute show: quiet opening, theme, build, a breath,
  // reprise, and a full finale when every jet runs at height.
  fountain: {
    id: 'fountain', bpm: 84, beatsPerBar: 4,
    chords: [
      [50, 54, 57, 62], [49, 52, 57, 61], [47, 50, 54, 59], [42, 45, 49, 54], // D  A/C#  Bm  F#m
      [43, 50, 55, 59], [42, 50, 54, 57], [40, 47, 52, 55], [45, 52, 57, 61], // G  D/F#  Em  A
      [47, 50, 54, 59], [43, 50, 55, 59], [50, 54, 57, 62], [45, 52, 57, 61], // Bm G   D   A
      [43, 50, 55, 59], [45, 49, 52, 57], [38, 50, 54, 57], [50, 54, 57, 62], // G  A   D   D
    ],
    sections: [
      { name: 'opening', from: 0, intensity: 0.35 },
      { name: 'theme', from: 120, intensity: 0.55 },
      { name: 'build', from: 480, intensity: 0.72 },
      { name: 'breath', from: 780, intensity: 0.45 },
      { name: 'reprise', from: 900, intensity: 0.82 },
      { name: 'finale', from: 1080, intensity: 1 },
    ],
  },
  // The boat run — a processional in B-flat: a fanfare as the first bridge rises, a march while the leaves climb one
  // after another, and a cadence as they come down.
  bridge: {
    id: 'bridge', bpm: 108, beatsPerBar: 4,
    chords: [
      [46, 53, 58, 62], [41, 53, 57, 60], [43, 50, 55, 58], [39, 51, 55, 58], // Bb F  Gm Eb
      [46, 50, 53, 58], [41, 48, 53, 57], [39, 51, 55, 58], [41, 53, 57, 60], // Bb F  Eb F
    ],
    sections: [
      { name: 'fanfare', from: 0, intensity: 1 },
      { name: 'march', from: 12, intensity: 0.7 },
      { name: 'climax', from: 150, intensity: 0.9 },
      { name: 'cadence', from: 220, intensity: 0.5 },
    ],
  },
}

export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12)
const RAMP_S = 8 // intensity glides into each new section

export function scoreAt(score, t) {
  const beatLen = 60 / score.bpm, beats = Math.max(0, t) / beatLen, whole = Math.floor(beats)
  const bar = Math.floor(whole / score.beatsPerBar), beat = whole % score.beatsPerBar
  const secs = score.sections
  let si = 0
  for (let i = 0; i < secs.length; i++) if (secs[i].from <= t) si = i
  const cur = secs[si], prev = secs[Math.max(0, si - 1)], k = Math.min(1, (t - cur.from) / RAMP_S)
  const intensity = si === 0 ? cur.intensity : prev.intensity + (cur.intensity - prev.intensity) * k
  return {
    t, bar, beat, beatFrac: beats - whole, barFrac: (beats / score.beatsPerBar) % 1, downbeat: beat === 0,
    chord: score.chords[bar % score.chords.length], section: cur.name, intensity,
  }
}

const clamp01 = (x) => Math.max(0, Math.min(1, x))
// Jet levels (0…1, scaling each jet's full height) and the light colour for one moment of the fountain score.
export function fountainChoreo(st) {
  const kick = Math.exp(-st.beatFrac * 4), barKick = Math.exp(-st.barFrac * 3)
  const swell = Math.sin((st.bar % 2 + st.barFrac) * Math.PI) // a two-bar breath
  return {
    centre: clamp01(0.25 + 0.75 * st.intensity * (0.9 + 0.1 * swell)),
    seahorse: clamp01(0.55 + 0.45 * barKick * (0.6 + 0.4 * st.intensity)),
    ring: clamp01(0.3 + 0.7 * kick * (0.5 + 0.5 * st.intensity)),
    lower: clamp01(0.5 + 0.5 * st.intensity),
    colour: SHOW_COLOURS[st.bar % SHOW_COLOURS.length],
  }
}

// The two red gate lights at a bridge approach alternate once a second while its lift is under way (the warning
// runs before its own leaves move, as the real gates do).
export const gateFlash = (angle, active, phase) => (active ? (phase % 1 < 0.5 ? [1, 0] : [0, 1]) : [0, 0])
