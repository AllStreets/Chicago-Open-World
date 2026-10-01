// app/src/hud/__tests__/addressPalette.test.jsx — typed addresses in ⌘K (P4 Task 8).
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../../state/store.js'
import { addressRows } from '../../lib/paletteSources.js'

describe('address rows', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('"333 N Green" offers Set office (opens WORK) and Fly to', () => {
    const rows = addressRows('333 N Green')
    expect(rows.map((r) => r.name)).toEqual(['Set office at 333 N GREEN', 'Fly to 333 N GREEN'])
    rows[0].run()
    const s = useStore.getState()
    expect(s.office.label).toBe('333 N GREEN'); expect(s.lens).toBe('WORK')
  })
  it('anything that is not an address offers nothing', () => { expect(addressRows('pizza')).toEqual([]) })
})
