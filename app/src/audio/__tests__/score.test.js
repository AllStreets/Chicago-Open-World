import { describe, it, expect } from 'vitest'
import { SCORES, scoreAt, midiToHz, fountainChoreo, gateFlash } from '../score.js'

describe('show scores (original, synthesised)', () => {
  it('fountain and bridge scores are well-formed: tempo, a chord per bar, sections covering the show', () => {
    for (const s of [SCORES.fountain, SCORES.bridge]) {
      expect(s.bpm).toBeGreaterThan(60); expect(s.bpm).toBeLessThan(140)
      expect(s.chords.length).toBeGreaterThanOrEqual(8)
      for (const c of s.chords) { expect(c.length).toBeGreaterThanOrEqual(3); for (const n of c) expect(n).toBeGreaterThan(30) }
      expect(s.sections.length).toBeGreaterThan(1)
    }
  })
  it('scoreAt: bars, beats and the chord advance with time; the progression loops', () => {
    const s = SCORES.fountain, beat = 60 / s.bpm, bar = beat * s.beatsPerBar
    expect(scoreAt(s, 0)).toMatchObject({ bar: 0, beat: 0, downbeat: true })
    expect(scoreAt(s, beat * 1.5)).toMatchObject({ bar: 0, beat: 1 })
    expect(scoreAt(s, bar * 3 + 0.01).chord).toEqual(s.chords[3])
    expect(scoreAt(s, bar * s.chords.length + 0.01).chord).toEqual(s.chords[0])
    const x = scoreAt(s, beat * 2.25); expect(x.beatFrac).toBeCloseTo(0.25, 6)
  })
  it('intensity rises into the finale (the last section is the loudest)', () => {
    const s = SCORES.fountain, end = s.sections.at(-1)
    expect(scoreAt(s, end.from + 1).intensity).toBeGreaterThan(scoreAt(s, 5).intensity)
    for (let t = 0; t < 1200; t += 13) { const i = scoreAt(s, t).intensity; expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThanOrEqual(1) }
  })
  it('midiToHz: A4 = 440', () => { expect(midiToHz(69)).toBeCloseTo(440); expect(midiToHz(57)).toBeCloseTo(220) })
})

describe('fountain choreography', () => {
  const s = SCORES.fountain, beat = 60 / s.bpm
  it('jets dance to the music: the ring pulses on the beat and relaxes between', () => {
    const on = fountainChoreo(scoreAt(s, 300 + 0.01)), off = fountainChoreo(scoreAt(s, 300 + beat * 0.7))
    expect(on.ring).toBeGreaterThan(off.ring)
    for (const c of [on, off]) for (const k of ['centre', 'seahorse', 'ring', 'lower']) { expect(c[k]).toBeGreaterThanOrEqual(0); expect(c[k]).toBeLessThanOrEqual(1) }
  })
  it('the centre column swells with the music and reaches full height in the finale', () => {
    const quiet = fountainChoreo(scoreAt(s, 10)).centre, fin = fountainChoreo(scoreAt(s, s.sections.at(-1).from + 30)).centre
    expect(fin).toBeGreaterThan(quiet); expect(fin).toBeGreaterThan(0.9)
  })
  it('the light colour follows the harmony (changes with the bar, holds within it)', () => {
    const bar = beat * s.beatsPerBar
    expect(fountainChoreo(scoreAt(s, 1)).colour).toEqual(fountainChoreo(scoreAt(s, 1.5)).colour)
    expect(fountainChoreo(scoreAt(s, bar + 0.1)).colour).not.toEqual(fountainChoreo(scoreAt(s, 0.1)).colour)
  })
})

describe('bridge gate flashers', () => {
  it('alternate once a second while a bridge is moving or about to; dark otherwise', () => {
    expect(gateFlash(0, false, 0.2)).toEqual([0, 0])
    const a = gateFlash(0.3, true, 0.25), b = gateFlash(0.3, true, 0.75)
    expect(a[0] + a[1]).toBe(1); expect(b[0] + b[1]).toBe(1); expect(a).not.toEqual(b)
    expect(gateFlash(0, true, 0.25)[0] + gateFlash(0, true, 0.25)[1]).toBe(1) // warning before its leaves move
  })
})
