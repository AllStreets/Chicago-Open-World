import { describe, it, expect } from 'vitest'
import { keyIntent } from '../controls.js'
const k = (...c) => new Set(c)
describe('keyIntent (Google-Earth-style)', () => {
  it('arrows and WASD move', () => {
    expect(keyIntent(k('ArrowUp')).move).toEqual([1, 0])
    expect(keyIntent(k('KeyS')).move).toEqual([-1, 0])
    expect(keyIntent(k('ArrowLeft')).move).toEqual([0, -1])
    expect(keyIntent(k('KeyD')).move).toEqual([0, 1])
  })
  it('Shift+arrows turn and tilt instead of moving', () => {
    const i = keyIntent(k('ShiftLeft', 'ArrowLeft', 'ArrowUp'))
    expect(i.move).toEqual([0, 0]); expect(i.turn).toBe(-1); expect(i.tilt).toBe(1)
  })
  it('Q/E turn, R/F and PageUp/PageDown climb, +/- zoom', () => {
    expect(keyIntent(k('KeyQ')).turn).toBe(-1); expect(keyIntent(k('KeyE')).turn).toBe(1)
    expect(keyIntent(k('KeyR')).climb).toBe(1); expect(keyIntent(k('PageDown')).climb).toBe(-1)
    expect(keyIntent(k('Equal')).zoom).toBe(1); expect(keyIntent(k('Minus')).zoom).toBe(-1)
  })
  it('Shift with letters boosts', () => {
    expect(keyIntent(k('ShiftLeft', 'KeyW')).boost).toBe(true)
    expect(keyIntent(k('KeyW')).boost).toBe(false)
  })
  it('nothing pressed is idle', () => {
    expect(keyIntent(k())).toEqual({ move: [0, 0], turn: 0, tilt: 0, climb: 0, zoom: 0, boost: false })
  })
})
