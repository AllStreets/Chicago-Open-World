// app/src/transit/__tests__/lineEmphasis.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { setLineGain, setLinePulse, resetLineEmphasis, lineEmphasisState, setLineIndex } from '../lineEmphasis.js'

// Ruling (P4 Task 2): V3 has no static line table — each transit.json line carries its glow index
const LINES = [{ id: 'red', index: 0 }, { id: 'blue', index: 1 }, { id: 'brown', index: 2 }]
const LINE_INDEX = Object.fromEntries(LINES.map((l) => [l.id, l.index]))
setLineIndex(LINES)

describe('line emphasis', () => {
  beforeEach(resetLineEmphasis)
  it('defaults to gain 1 and pulse 0', () => {
    const s = lineEmphasisState()
    expect(s.gain[LINE_INDEX.red]).toBe(1); expect(s.pulse[LINE_INDEX.red]).toBe(0)
  })
  it('clamps gain to 0..2 and pulse to 0..1', () => {
    setLineGain('red', 5); setLinePulse('blue', -1)
    expect(lineEmphasisState().gain[LINE_INDEX.red]).toBe(2)
    expect(lineEmphasisState().pulse[LINE_INDEX.blue]).toBe(0)
  })
  it('ignores unknown line ids', () => {
    expect(() => setLineGain('teal', 1.5)).not.toThrow()
  })
})
