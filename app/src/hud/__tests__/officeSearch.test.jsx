// app/src/hud/__tests__/officeSearch.test.jsx — your office in ⌘K, remembered across visits (user, 2026-09-30).
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, loadSavedOffice } from '../../state/store.js'
import { officeRows } from '../../lib/paletteSources.js'

const flexport = { kind: 'landmark', name: '333 North Green · Flexport Chicago', pose: { position: [0, 300, 400], target: [-1674, 40, -653] }, x: -1674, z: -653 }
describe('office search', () => {
  beforeEach(() => { try { localStorage.clear() } catch { /* */ } useStore.setState(useStore.getInitialState()) })
  it('offers "Set … as my office" for a landmark result, and remembers it across visits', () => {
    const rows = officeRows('flexport', flexport)
    const set = rows.find((r) => r.name === 'Set 333 North Green · Flexport Chicago as my office')
    set.run()
    expect(useStore.getState().office).toMatchObject({ x: -1674, z: -653, label: '333 North Green · Flexport Chicago' })
    expect(loadSavedOffice()).toMatchObject({ label: '333 North Green · Flexport Chicago' })
  })
  it('"work" or "office" finds the office you set, and opens the Work lens', () => {
    useStore.getState().setOffice({ x: 1, z: 2, label: 'Flexport Chicago' })
    for (const q of ['work', 'office', 'my office']) {
      const r = officeRows(q, null)
      expect(r[0].name).toBe('Work: Flexport Chicago')
    }
    officeRows('work', null)[0].run()
    expect(useStore.getState().lens).toBe('WORK')
  })
  it('nothing to offer with no office and no landmark result', () => { expect(officeRows('work', null)).toEqual([]) })
})
