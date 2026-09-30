// app/src/landmarks/__tests__/showStop.test.js — user fixes (2026-09-29): the fountain and the bridges stop with one
// click and go back to normal; the fountain's music is only everywhere for a show you started.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fountainShow } from '../fountainSchedule.js'
import { fountainMusicRange } from '../showClock.js'
import { featureById } from '../../hud/featureControls.js'
import { useStore } from '../../state/store.js'
import { liftState, LIFT_DEMO, STOP_LOWER_S } from '../../bridges/lift.js'

const SHOW = new Date('2026-09-29T20:05:00-05:00') // 8:05 pm, inside the 8 pm show
describe('stopping the fountain', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  afterEach(() => vi.useRealTimers())
  it('a scheduled show stopped a minute ago shows the plain display until the next show', () => {
    expect(fountainShow(SHOW, {}).state).toBe('show')
    expect(fountainShow(SHOW, { stoppedAt: SHOW.getTime() - 60_000 }).state).toBe('display')
    // a stop from the previous hour's show doesn't cancel this one
    expect(fountainShow(SHOW, { stoppedAt: SHOW.getTime() - 3600_000 }).state).toBe('show')
  })
  it('the Fountain button reads a scheduled show as on and one click stops it; the next click starts a preview', () => {
    const f = featureById('fountain')
    vi.useFakeTimers(); vi.setSystemTime(SHOW)
    expect(f.isOn()).toBe(true)
    f.toggle()
    expect(f.isOn()).toBe(false)
    expect(useStore.getState().fountainStoppedAt).not.toBeNull()
    f.toggle()
    expect(useStore.getState().fountainPreview).not.toBeNull()
    expect(f.isOn()).toBe(true)
  })
  it('music: a show you started is heard across downtown, a scheduled one only near the fountain', () => {
    expect(fountainMusicRange('preview')).toBeGreaterThan(2000)
    expect(fountainMusicRange('show')).toBeLessThanOrEqual(500)
  })
})

describe('stopping the bridges', () => {
  it('a stopped lift is back to normal within a few seconds', () => {
    const order = ['a', 'b', 'c'], start = 1e6
    const mid = start + 20_000
    expect(liftState({ now: mid + STOP_LOWER_S * 1000 + 1, manualStart: start, manualStop: mid, order }).done).toBe(true)
    expect(STOP_LOWER_S).toBeLessThanOrEqual(8)
  })
  it('a demo lift gets every bridge moving within half a minute', () => {
    expect(LIFT_DEMO.staggerS * 10).toBeLessThanOrEqual(30)
  })
})

describe('the fireworks button (user request)', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  afterEach(() => vi.useRealTimers())
  it('X / the button starts a show; pressing again stops it, even a scheduled one', () => {
    const f = featureById('fireworks')
    expect(f.key).toBe('KeyX'); expect(f.commandName).toMatch(/Navy Pier fireworks/)
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T14:00:00-05:00'))
    expect(f.isOn()).toBe(false)
    f.toggle(); expect(f.isOn()).toBe(true)
    f.toggle(); expect(f.isOn()).toBe(false)
    vi.setSystemTime(new Date('2026-07-15T21:03:00-05:00')) // a scheduled Wednesday show
    useStore.setState(useStore.getInitialState())
    expect(f.isOn()).toBe(true); f.toggle(); expect(f.isOn()).toBe(false)
  })
})
