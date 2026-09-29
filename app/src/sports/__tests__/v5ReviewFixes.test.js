// V5 final-review fixes: each test reproduces one reviewer finding.
import { describe, it, expect } from 'vitest'
import { whenChicago } from '../chicagoTime.js'
import { stateLabel } from '../tonight.js'
import { gamePlaces } from '../palette.js'
import { boardLines } from '../scoreboard.js'
import { flagMaterial } from '../WinFlag.jsx'
import * as THREE from 'three'

const T = (iso) => Date.parse(iso)
const now = T('2026-09-29T17:00:00Z') // Tue 29 Sep, 12:00 CDT

describe('V5 review fixes', () => {
  it('#1 future games carry their date unless they are today or tomorrow', () => {
    expect(whenChicago(T('2026-09-30T00:05:00Z'), now)).toBe('Tonight 7:05 PM')          // Tue 19:05
    expect(whenChicago(T('2026-09-29T18:20:00Z'), now)).toBe('Today 1:20 PM')
    expect(whenChicago(T('2026-10-01T00:05:00Z'), now)).toBe('Tomorrow 7:05 PM')         // Wed 19:05
    expect(whenChicago(T('2026-10-04T17:00:00Z'), now)).toBe('Sun Oct 4 12:00 PM')
    expect(whenChicago(T('2027-04-06T19:20:00Z'), now)).toBe('Tue Apr 6 2:20 PM')
    const st = { state: 'idle', next: { start: '2027-04-06T19:20:00Z' } }
    expect(stateLabel(st, now)).toBe('NEXT TUE APR 6 2:20 PM')
  })
  it('#1 ⌘K says "next game", not "tonight", when nothing is on today', () => {
    const W = { key: 'wrigleyfield', name: 'Wrigley Field', teams: ['cubs'], center: [0, 0] }
    const next = { id: 'n', start: '2026-10-04T17:00:00Z', home: { abbr: 'CHC' }, away: { abbr: 'MIL' } }
    const [first] = gamePlaces({ venues: [W], states: { wrigleyfield: { state: 'idle', game: null, next } }, nowMs: now })
    expect(first.name).toBe('Go to the next game'); expect(first.sub).toMatch(/Sun Oct 4/)
  })
  it('#2 the board names the visiting team relative to its own venue (Crosstown at Rate Field)', () => {
    const rate = { key: 'ratefield', name: 'Rate Field', teams: ['whitesox'] }
    const n = { start: '2026-06-20T18:10:00Z', chicagoHome: false, home: { abbr: 'CHW' }, away: { abbr: 'CHC' } } // merged from the Cubs' listing
    expect(boardLines(rate, { state: 'idle', next: n }, now).status).toMatch(/^NEXT CHC /)
  })
  it('#3 the W/L flag glows with its own picture at night', () => {
    const tex = new THREE.Texture()
    const m = flagMaterial(tex)
    expect(m.emissiveMap).toBe(tex)
    expect(m.emissive.getHex()).toBe(0xffffff)
  })
})
