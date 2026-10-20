import { describe, it, expect, vi } from 'vitest'
import { createDoubleTap } from '../doubleTap.js'

const ev = (t, x = 100, y = 100, extra = {}) => ({ pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, timeStamp: t, ...extra })
const tap = (d, t, x, y) => { d.down(ev(t, x, y)); return d.up(ev(t + 60, x, y)) }

describe('double tap', () => {
  it('two quick taps in one spot fly', () => {
    const fly = vi.fn(); const d = createDoubleTap(fly)
    tap(d, 0); tap(d, 200)
    expect(fly).toHaveBeenCalledTimes(1)
  })
  it('taps too far apart in time or space do not', () => {
    const fly = vi.fn(); const d = createDoubleTap(fly)
    tap(d, 0); tap(d, 900)
    tap(d, 2000, 100, 100); tap(d, 2150, 200, 100)
    expect(fly).not.toHaveBeenCalled()
  })
  it('a drag or a long press is not a tap', () => {
    const fly = vi.fn(); const d = createDoubleTap(fly)
    d.down(ev(0)); d.up(ev(60, 160, 100)) // moved
    tap(d, 150)
    d.down(ev(400)); d.up(ev(900)) // held
    tap(d, 1000)
    expect(fly).not.toHaveBeenCalled()
  })
  it('a mouse never counts, and a third tap starts over', () => {
    const fly = vi.fn(); const d = createDoubleTap(fly)
    d.down(ev(0, 100, 100, { pointerType: 'mouse' })); d.up(ev(50, 100, 100, { pointerType: 'mouse' }))
    tap(d, 100); tap(d, 300); tap(d, 500)
    expect(fly).toHaveBeenCalledTimes(1)
  })
})
