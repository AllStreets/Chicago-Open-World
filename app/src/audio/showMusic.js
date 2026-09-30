// app/src/audio/showMusic.js — plays a show score (score.js) with WebAudio voices: a string-like pad, a bass, an
// arpeggio and a simple melody drawn from each bar's chord; the bridge score adds the gate bells and a ship's horn.
// No audio files. A look-ahead scheduler places each beat once on the audio clock; the caller drives it with the
// show's own clock (tick(showSeconds)), so a jump ahead never replays skipped beats.
import { scoreAt, midiToHz } from './score.js'

export const LOOKAHEAD_S = 0.2

export function createShowMusic(ctx, score, { bells = false } = {}) {
  const out = ctx.createGain(); out.gain.value = 0
  const panner = ctx.createPanner()
  Object.assign(panner, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 60, maxDistance: 3000, rolloffFactor: 1.1 })
  out.connect(panner).connect(ctx.destination)
  const beatLen = 60 / score.bpm
  let nextBeat = null, level = 0
  const played = new Set() // which voices have sounded (bounded: one entry per voice kind)

  function env(g, t, attack, peak, release) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.setTargetAtTime(0.0001, t + attack, release)
  }
  function voice(type, hz, t, dur, peak, { attack = 0.01, release = dur / 3, detune = 0, filter = null } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.value = hz; if (detune) o.detune.value = detune
    let head = o
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; head = head.connect(f) }
    head.connect(g).connect(out)
    env(g, t, attack, peak, release)
    o.start(t); o.stop(t + dur + release * 4)
  }
  const pad = (chord, t, st) => {
    const bar = beatLen * score.beatsPerBar
    for (const n of chord.slice(1)) for (const d of [-7, 7]) voice('sawtooth', midiToHz(n), t, bar, 0.025 * (0.6 + 0.4 * st.intensity), { attack: 0.5, release: 0.8, detune: d, filter: 700 + 1600 * st.intensity })
    played.add('pad')
  }
  const bass = (chord, t, st) => { voice('triangle', midiToHz(chord[0] - 12), t, beatLen * 1.8, 0.16 * (0.7 + 0.3 * st.intensity), { attack: 0.02, release: 0.4 }); played.add('bass') }
  const arp = (chord, t, st, beatInBar) => {
    const steps = st.intensity > 0.6 ? 2 : 1
    for (let k = 0; k < steps; k++) {
      const n = chord[1 + ((beatInBar * steps + k) % (chord.length - 1))] + 12
      voice('triangle', midiToHz(n), t + (k * beatLen) / steps, beatLen / steps, 0.05 * st.intensity, { attack: 0.005, release: 0.18 })
    }
    played.add('arp')
  }
  const MELODY = [[3, 2], [2, 1], [1, 1]] // chord-tone index, beats: a half note and two quarters, every bar
  const melody = (chord, t, st, beatInBar) => {
    let at = 0
    for (const [idx, beats] of MELODY) {
      if (at === beatInBar) voice('sine', midiToHz(chord[Math.min(idx, chord.length - 1)] + 24), t, beatLen * beats, 0.06 * (0.4 + 0.6 * st.intensity), { attack: 0.04, release: 0.35 })
      at += beats
    }
    played.add('melody')
  }
  const bell = (t) => { for (const [hz, a] of [[1760, 0.05], [4400, 0.015]]) voice('sine', hz, t, 0.05, a, { attack: 0.002, release: 0.25 }); played.add('bell') }
  const horn = (t) => { for (const hz of [98, 146.8]) voice('sawtooth', hz, t, 2.4, 0.09, { attack: 0.15, release: 0.6, filter: 520 }); played.add('horn') }

  function playBeat(i, when) {
    const st = scoreAt(score, i * beatLen), chord = st.chord
    if (st.downbeat) pad(chord, when, st)
    if (st.beat % 2 === 0) bass(chord, when, st)
    arp(chord, when, st, st.beat)
    melody(chord, when, st, st.beat)
    if (bells && st.beat % 2 === 0) bell(when)
    if (score.id === 'bridge' && i === 0) horn(when)
  }

  return {
    out, played,
    // schedule every beat that falls in [showT, showT + LOOKAHEAD_S) and has not been scheduled yet
    tick(showT) {
      // the first tick lands a few ms into the show: a beat that began within the lookahead still plays (the horn, the opening chord)
      const floor = Math.floor(showT / beatLen + 1e-9), first = showT - floor * beatLen < LOOKAHEAD_S ? floor : floor + 1
      if (nextBeat == null || first > nextBeat + 1 || first < nextBeat - 1) nextBeat = first // a jump: start from here
      while (nextBeat * beatLen < showT + LOOKAHEAD_S) {
        const when = ctx.currentTime + Math.max(0, nextBeat * beatLen - showT)
        playBeat(nextBeat, when)
        nextBeat++
      }
    },
    setLevel(l) { if (Math.abs(l - level) > 0.01) { out.gain.setTargetAtTime(l, ctx.currentTime, 0.4); level = l } },
    setPosition([x, y, z]) { if (panner.positionX) { panner.positionX.value = x; panner.positionY.value = y; panner.positionZ.value = z } else panner.setPosition?.(x, y, z) },
    // fade over ~1 s, then let go of the nodes (already-scheduled notes play into a silent, disconnected graph)
    stop() { out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => { out.disconnect(); panner.disconnect() }, 1500) },
  }
}
