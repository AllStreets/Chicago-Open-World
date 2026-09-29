import { describe, it, expect } from 'vitest'
import { fountainShow, showLevels } from '../fountainSchedule.js'
const at = (iso, o) => fountainShow(new Date(iso), o)

describe('Buckingham schedule (Chicago time, any host zone)', () => {
  it('hourly 20-minute shows, steady display in between', () => {
    expect(at('2026-09-28T17:05:00Z').state).toBe('show')      // 12:05 CDT
    expect(at('2026-09-28T17:25:00Z').state).toBe('display')   // 12:25 CDT
  })
  it('opens at 8:00 with a show, last show at 22:00, off from 23:00', () => {
    expect(at('2026-05-01T12:59:00Z').state).toBe('off')       // 07:59
    expect(at('2026-05-01T13:00:00Z').state).toBe('show')      // 08:00
    expect(at('2026-10-15T03:15:00Z').state).toBe('show')      // Oct 14 22:15
    expect(at('2026-10-15T03:25:00Z').state).toBe('display')   // 22:25
    expect(at('2026-06-01T04:00:00Z').state).toBe('off')       // 23:00
  })
  it('season: early May to mid-October', () => {
    expect(at('2026-04-30T17:05:00Z').reason).toBe('season')
    expect(at('2026-10-15T17:05:00Z').state).toBe('show')      // Oct 15, last day
    expect(at('2026-10-16T17:05:00Z').reason).toBe('season')
  })
  it('after dark the show is coloured; by day it is plain water', () => {
    expect(at('2026-09-28T17:05:00Z', { dark: true }).colour).toHaveLength(3)
    expect(at('2026-09-28T17:05:00Z').colour).toBeNull()
  })
  it('the finale throws the full 46 m centre jet', () => {
    expect(showLevels(18).centre).toBe(1)
    expect(showLevels(5).centre).toBeLessThan(1)
  })
  it('J plays a 20-minute preview at any time or season', () => {
    const start = Date.parse('2026-01-10T08:00:00Z')
    expect(fountainShow(new Date(start + 60_000), { previewStart: start }).state).toBe('show')
    expect(fountainShow(new Date(start + 21 * 60_000), { previewStart: start }).state).toBe('off')
  })
})
