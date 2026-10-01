// app/src/ride/__tests__/rideNames.test.js — F-4 (2026-10-01): every L ride has its own name, and the name says what
// the train really does — which branch's Western, where it is signed to, and "around the Loop" only for the lines that
// circle the elevated Loop (Brown, Orange, Pink, Purple). Checked against the shipped transit data.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { createSim } from '../../transit/sim.js'
import { lRides } from '../rideCatalog.js'

const transit = JSON.parse(fs.readFileSync(`${process.cwd()}/public/world/transit.json`, 'utf8')) // vitest runs in app/
const sim = createSim(transit)
const rides = lRides(sim, transit)
const byLine = (id) => rides.filter((r) => r.line === id).map((r) => r.name)

describe('L ride names (F-4)', () => {
  it('are unique', () => {
    const names = rides.map((r) => r.name)
    expect(names.length).toBeGreaterThan(5)
    expect(new Set(names).size).toBe(names.length)
  })
  it('the Blue Line names its two Westerns by branch, in the direction of travel', () => {
    expect(byLine('blue').sort()).toEqual([
      "Blue Line to Forest Park · Western (O'Hare branch) → Western (Forest Park branch)",
      "Blue Line to O'Hare · Western (Forest Park branch) → Western (O'Hare branch)",
    ])
  })
  it('"around the Loop" only for the lines that circle it; the others say where they are signed to', () => {
    for (const id of ['brown', 'orange', 'pink', 'purple']) for (const n of byLine(id)) expect(n, id).toMatch(/ → around the Loop → /)
    for (const id of ['red', 'blue', 'green']) for (const n of byLine(id)) { expect(n, id).not.toMatch(/Loop/); expect(n, id).toMatch(/ to [^·]+ · /) }
    expect(byLine('pink')).toEqual(['Pink Line · California → around the Loop → Western'])
    expect(byLine('red').sort()).toEqual(['Red Line to 95th/Dan Ryan · Addison → Sox-35th', 'Red Line to Howard · Sox-35th → Addison'])
  })
  it('a ride that stands for two branches names both destinations', () => {
    expect(byLine('green')).toContain('Green Line to Ashland/63rd or Cottage Grove · Damen → 35th-Bronzeville-IIT')
    expect(byLine('green')).toContain('Green Line to Harlem/Lake · 35th-Bronzeville-IIT → Damen')
  })
})
