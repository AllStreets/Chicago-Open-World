import { describe, it, expect } from 'vitest'
import { flagKind, drawFlag, FLAG_COLORS } from '../winFlag.js'

describe('the W flag', () => {
  it('flies on W days, the L flag on L days, nothing otherwise', () => {
    expect(flagKind({ winDay: true, lossDay: false })).toBe('W')
    expect(flagKind({ winDay: false, lossDay: true })).toBe('L')
    expect(flagKind({ winDay: false, lossDay: false })).toBeNull()
    expect(flagKind(undefined)).toBeNull()
  })
  it('W is a blue W on white; L is a white L on blue', () => {
    const run = (kind) => { const calls = []; drawFlag(new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]), set: (_, k, v) => { calls.push([`=${String(k)}`, v]); return true } }), kind, 512, 320); return calls }
    const w = run('W')
    expect(w.filter((c) => c[0] === '=fillStyle').map((c) => c[1])).toEqual([FLAG_COLORS.white, FLAG_COLORS.blue])
    expect(w.find((c) => c[0] === 'fillText')[1]).toBe('W')
    const l = run('L')
    expect(l.filter((c) => c[0] === '=fillStyle').map((c) => c[1])).toEqual([FLAG_COLORS.blue, FLAG_COLORS.white])
    expect(l.find((c) => c[0] === 'fillText')[1]).toBe('L')
  })
})
