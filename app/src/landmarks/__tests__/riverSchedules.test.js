// app/src/landmarks/__tests__/riverSchedules.test.js — the river's scheduled shows are on exactly when their sources
// say (A-5 Art on theMART, A-11 the Centennial Fountain arc).
import { describe, it, expect } from 'vitest'
import { artOnTheMart, centennialArc, ART_ON_THE_MART, CENTENNIAL_ARC } from '../riverSchedules.js'

describe('river schedules (A-5, A-11)', () => {
  const at = (s) => new Date(s)
  it('Art on theMART runs Thursday to Sunday, 30 minutes from the season\'s start time', () => {
    expect(artOnTheMart(at('2026-10-01T19:45:00-05:00')).on).toBe(true)  // Thu, autumn window 7:30–8:00 pm
    expect(artOnTheMart(at('2026-10-01T20:05:00-05:00')).on).toBe(false)
    expect(artOnTheMart(at('2026-09-28T19:45:00-05:00')).reason).toBe('day') // Monday
    expect(artOnTheMart(at('2026-07-11T21:10:00-05:00')).on).toBe(true)  // Sat, summer window 9:00–9:30 pm
    expect(artOnTheMart(at('2026-01-15T19:45:00-06:00')).reason).toBe('season')
  })
  it('the Centennial Fountain arc runs five minutes at the top of the hour, 10 am to 10 pm, May to September', () => {
    expect(centennialArc(at('2026-07-04T15:03:00-05:00')).on).toBe(true)
    expect(centennialArc(at('2026-07-04T15:06:00-05:00')).reason).toBe('between')
    expect(centennialArc(at('2026-07-04T09:02:00-05:00')).reason).toBe('hours')
    expect(centennialArc(at('2026-07-04T22:02:00-05:00')).on).toBe(true)
    expect(centennialArc(at('2026-10-04T12:02:00-05:00')).reason).toBe('season')
  })
})

describe('river schedule sources', () => {
  it('both schedules cite their source', () => {
    expect(ART_ON_THE_MART.source).toMatch(/artonthemart\.com/)
    expect(CENTENNIAL_ARC.source).toMatch(/mwrd\.org/)
  })
})
