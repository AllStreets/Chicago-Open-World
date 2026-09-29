import { describe, it, expect } from 'vitest'
import { paintField, toPx, MIN_LINE_PX } from '../paintField.js'

const recorder = () => {
  const calls = []
  const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]), set: (_, k, v) => { calls.push([`=${String(k)}`, v]); return true } })
  return { ctx, calls }
}
const F = { u0: -75, u1: 75, v0: -37.5, v1: 37.5 }

describe('paintField', () => {
  it('maps (u0, v1) to the top-left pixel and (u1, v0) to the bottom-right', () => {
    expect(toPx(F, 2048, 1024, [-75, 37.5])).toEqual([0, 0])
    expect(toPx(F, 2048, 1024, [75, -37.5])).toEqual([2048, 1024])
  })
  it('lines are never thinner than 1.5 px; clip saves, unclip restores', () => {
    const { ctx, calls } = recorder()
    paintField(ctx, [{ op: 'clip', pts: [[0, 0], [1, 0], [1, 1]] }, { op: 'line', pts: [[0, 0], [0, 10]], width: 0.05, color: '#fff' }, { op: 'unclip' }], F, 2048, 1024)
    expect(calls.find((c) => c[0] === '=lineWidth')[1]).toBe(MIN_LINE_PX)
    expect(calls.map((c) => c[0])).toEqual(expect.arrayContaining(['save', 'clip', 'stroke', 'restore']))
  })
  it('text is rotated so its reading direction follows the frame angle', () => {
    const { ctx, calls } = recorder()
    paintField(ctx, [{ op: 'text', text: 'BEARS', at: [50.3, 0], size: 6.4, angle: -Math.PI / 2, color: '#fff', stroke: '#C83803', strokeWidth: 0.35 }], F, 2048, 1024)
    expect(calls.find((c) => c[0] === 'rotate')[1]).toBeCloseTo(Math.PI / 2)
    expect(calls.some((c) => c[0] === 'strokeText' && c[1] === 'BEARS')).toBe(true)
    expect(calls.some((c) => c[0] === 'fillText' && c[1] === 'BEARS')).toBe(true)
  })
})
