// app/src/world/__tests__/picker.test.js — hover stays quiet while the camera is busy (P4 Task 3, review focus 1).
import { describe, it, expect } from 'vitest'
import { quiet } from '../Picker.jsx'

describe('Picker suppression', () => {
  it('is quiet during a flight, a playing tour, a follow or with the palette open', () => {
    expect(quiet({})).toBe(false)
    expect(quiet({ flight: { to: {} } })).toBe(true)
    expect(quiet({ tour: { id: 'x', t: 0, playing: true } })).toBe(true)
    expect(quiet({ tour: { id: 'x', t: 0, playing: false } })).toBe(false)
    expect(quiet({ follow: { trainId: 't' } })).toBe(true)
    expect(quiet({ paletteOpen: true })).toBe(true)
  })
})
