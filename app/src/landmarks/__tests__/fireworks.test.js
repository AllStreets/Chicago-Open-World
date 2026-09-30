// app/src/landmarks/__tests__/fireworks.test.js — Navy Pier's summer fireworks (user request 2026-09-29).
import { describe, it, expect } from 'vitest'
import { FIREWORKS, fireworksShow, BARGE } from '../fireworksSchedule.js'
import { buildShow, flashAt, SHOW_S } from '../fireworksChoreo.js'

const at = (iso, o) => fireworksShow(new Date(iso), o)
describe('fireworks schedule (navypier.org)', () => {
  it('Wednesdays at 9 pm and Saturdays at 10 pm in season', () => {
    expect(at('2026-07-15T21:05:00-05:00').state).toBe('show') // a Wednesday
    expect(at('2026-07-18T22:03:00-05:00').state).toBe('show') // a Saturday
    expect(at('2026-07-16T21:05:00-05:00').state).toBe('off')  // a Thursday
    expect(at('2026-07-15T20:55:00-05:00').state).toBe('off')  // before the show
  })
  it('no shows outside the season (late May – early September)', () => {
    expect(at('2026-09-30T21:05:00-05:00').state).toBe('off')
    expect(at('2026-05-20T21:05:00-05:00').state).toBe('off')
  })
  it('a started show runs its length; a stop ends it', () => {
    const start = Date.parse('2026-09-29T14:00:00-05:00')
    expect(fireworksShow(new Date(start + 60_000), { previewStart: start }).state).toBe('show')
    expect(fireworksShow(new Date(start + (SHOW_S + 5) * 1000), { previewStart: start }).state).toBe('off')
    expect(at('2026-07-15T21:05:00-05:00', { stoppedAt: Date.parse('2026-07-15T21:04:00-05:00') }).state).toBe('off')
  })
  it('the barge sits in the lake just south of the pier\'s outer half, and the source is cited', () => {
    expect(BARGE[0]).toBeGreaterThan(1700); expect(BARGE[2]).toBeGreaterThan(-1000); expect(BARGE[2]).toBeLessThan(-700)
    expect(FIREWORKS.source).toMatch(/navypier\.org/)
  })
})

describe('fireworks choreography', () => {
  const show = buildShow(7)
  it('is deterministic', () => { expect(buildShow(7).shells.length).toBe(show.shells.length); expect(buildShow(7).shells[10]).toEqual(show.shells[10]) })
  it('bursts at 100–250 m over the barge, within a few hundred metres of it', () => {
    for (const s of show.shells) {
      expect(s.burst[1]).toBeGreaterThanOrEqual(100); expect(s.burst[1]).toBeLessThanOrEqual(250)
      expect(Math.hypot(s.burst[0] - BARGE[0], s.burst[2] - BARGE[2])).toBeLessThan(260)
    }
  })
  it('uses every kind of shell, and the finale is a barrage', () => {
    const kinds = new Set(show.shells.map((s) => s.kind))
    for (const k of ['peony', 'chrysanthemum', 'willow', 'ring', 'crossette', 'crackle']) expect(kinds.has(k)).toBe(true)
    const rate = (a, b) => show.shells.filter((s) => s.t >= a && s.t < b).length / (b - a)
    expect(rate(SHOW_S - 45, SHOW_S)).toBeGreaterThan(rate(60, SHOW_S - 120) * 3)
  })
  it('the flash follows the bursts: bright just after one, dark between', () => {
    const s = show.shells.find((x) => x.t > 30)
    expect(flashAt(show, s.t + 0.1).intensity).toBeGreaterThan(flashAt(show, s.t - 5).intensity)
    expect(flashAt(show, -10).intensity).toBe(0)
  })
  it('stays within a particle budget', () => { expect(show.particles).toBeLessThanOrEqual(120000) })
})

import { showBuffers, starPosition } from '../fireworksBuffers.js'
describe('fireworks buffers', () => {
  const show = buildShow(7)
  it('one star per particle the choreography counts; LOW keeps a fraction', () => {
    const b = showBuffers(show)
    expect(b.count).toBe(show.particles)
    expect(b.origin.length).toBe(b.count * 3); expect(b.params.length).toBe(b.count * 4)
    expect(showBuffers(show, { fraction: 0.4 }).count).toBeLessThan(b.count * 0.5)
  })
  it('stars slow to a drift and fall: drag, then gravity', () => {
    const p1 = starPosition([0, 200, 0], [40, 0, 0], 1.6, 9.8, 1), p3 = starPosition([0, 200, 0], [40, 0, 0], 1.6, 9.8, 3)
    expect(p3[0] - p1[0]).toBeLessThan(p1[0]) // most of the spread happens in the first second
    expect(p3[1]).toBeLessThan(p1[1])
  })
})

import { eventsBetween, SPEED_OF_SOUND, loudness } from '../../audio/fireworksAudio.js'
describe('fireworks sound', () => {
  const show = buildShow(7), s = show.shells.find((x) => x.t > 100)
  it('a burst is heard late by the speed of sound', () => {
    const cam = [s.burst[0] + 1715, 0, s.burst[2]]
    const d = Math.hypot(1715, s.burst[1])
    const ev = eventsBetween({ shells: [s] }, cam, s.t, s.t + 20).find((e) => e.kind !== 'launch')
    expect(ev.at - s.t).toBeCloseTo(d / SPEED_OF_SOUND, 3)
  })
  it('gets quieter with distance', () => { expect(loudness(3000)).toBeLessThan(loudness(300) / 5) })
})
