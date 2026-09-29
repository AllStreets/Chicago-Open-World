import { describe, it, expect } from 'vitest'
import { flyPose, flightDuration, poseForPlace } from '../flight.js'
const A = { position: [0, 300, 1000], target: [0, 0, 0] }, B = { position: [5000, 300, -5000], target: [5000, 0, -6000] }
describe('flight', () => {
  it('starts and ends exactly on the poses', () => {
    expect(flyPose(A, B, 0)).toEqual(A); expect(flyPose(A, B, 1)).toEqual(B)
  })
  it('arcs up over the city on long jumps', () => {
    const mid = flyPose(A, B, 0.5)
    expect(mid.position[1]).toBeGreaterThan(1000)
  })
  it('duration grows with distance, clamped', () => {
    expect(flightDuration(A, A)).toBeCloseTo(1.4)
    expect(flightDuration(A, B)).toBeGreaterThan(2.5)
    expect(flightDuration(A, { position: [90000, 0, 0], target: [90000, 0, 0] })).toBe(4.5)
  })
  it('poseForPlace frames a tower from the south-east, above min altitude', () => {
    const p = poseForPlace({ x: 100, z: -200, top: 400 })
    expect(p.target).toEqual([100, 200, -200])
    expect(p.position[0]).toBeGreaterThan(100); expect(p.position[2]).toBeGreaterThan(-200)
    expect(p.position[1]).toBeGreaterThan(400)
    expect(poseForPlace({ x: 0, z: 0, top: 0 }).position[1]).toBeGreaterThanOrEqual(30)
  })
})

import { beforeAll, afterAll } from 'vitest'
import { liftAboveRoofs, flightLift } from '../flight.js'
import { setHeightfield, clearanceAt } from '../clearance.js'
import { BOOKMARKS } from '../bookmarks.js'

// The 10 tallest landmarks in manifest v3 (x, z, top m) as 64 m square towers, plus a dense Loop: 6×6 towers, 40 m wide, 180 m tall, 20 m streets.
const TALL = [[-674, 366, 527], [394, -1865, 457], [115, -760, 423], [879, -578, 363], [522, -361, 346], [-572, 193, 307], [425, -376, 303], [-99, -1574, 296], [-657, 507, 293], [395, 1672, 281]]
const LOOP = []
for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) LOOP.push([-400 + i * 60, -100 + j * 60, 180])
const TOWERS = [...TALL.map(([x, z, top]) => ({ x, z, half: 32, top })), ...LOOP.map(([x, z, top]) => ({ x, z, half: 20, top }))]
const grid = { minX: -1600, minZ: -2800, cell: 8, width: 450, height: 750, scale: 0.1 }
function fixture() {
  const dm = new Uint16Array(grid.width * grid.height)
  for (const t of TOWERS) {
    const i0 = Math.floor((t.x - t.half - grid.minX) / grid.cell), i1 = Math.ceil((t.x + t.half - grid.minX) / grid.cell)
    const j0 = Math.floor((t.z - t.half - grid.minZ) / grid.cell), j1 = Math.ceil((t.z + t.half - grid.minZ) / grid.cell)
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = grid.minX + (i + 0.5) * grid.cell, cz = grid.minZ + (j + 0.5) * grid.cell
      if (Math.abs(cx - t.x) <= t.half && Math.abs(cz - t.z) <= t.half) dm[j * grid.width + i] = Math.max(dm[j * grid.width + i], t.top * 10)
    }
  }
  return dm
}
const inside = ([x, y, z]) => TOWERS.some((t) => Math.abs(x - t.x) <= t.half && Math.abs(z - t.z) <= t.half && y <= t.top)
const everyFrameClear = (from, to) => {
  const end = liftAboveRoofs(to), lift = flightLift(from, end)
  for (let s = 0; s <= 200; s++) expect(inside(liftAboveRoofs(flyPose(from, end, s / 200, lift)).position)).toBe(false)
  return lift
}

describe('flight clearance (G1)', () => {
  beforeAll(() => setHeightfield(grid, fixture()))
  afterAll(() => setHeightfield(grid, null))
  it('⌘K fly-to ends outside and above every one of the 10 tallest towers', () => {
    for (const [x, z, top] of TALL) {
      const end = liftAboveRoofs(poseForPlace({ x, z, top }))
      expect(inside(end.position)).toBe(false)
      expect(end.position[1]).toBeGreaterThanOrEqual(clearanceAt(end.position[0], end.position[2]))
    }
  })
  it('an end pose inside a tower is lifted to roof + 25 m; the target is kept', () => {
    const end = liftAboveRoofs({ position: [-674, 200, 366], target: [-674, 100, 300] })
    expect(end.position[0]).toBe(-674); expect(end.position[2]).toBe(366)
    expect(end.position[1]).toBeCloseTo(552, 6)
    expect(end.target).toEqual([-674, 100, 300])
  })
  it('no frame of a flight into the dense Loop, or to Willis, is inside a building', () => {
    everyFrameClear(BOOKMARKS.streeterville, { position: [-250, 90, 80], target: [-250, 0, 0] })
    everyFrameClear(BOOKMARKS.streeterville, poseForPlace({ x: -674, z: 366, top: 527 }))
  })
  it('the arc itself rises over a tower in the way (smooth, not only clamped)', () => {
    const from = { position: [-1100, 150, 366], target: [-1000, 100, 366] }, to = { position: [-250, 150, 366], target: [-150, 100, 366] }
    const lift = flightLift(from, to)
    expect(lift).toBeGreaterThan(0)
    for (let s = 10; s <= 90; s++) {
      const p = flyPose(from, to, s / 100, lift).position
      expect(p[1]).toBeGreaterThanOrEqual(clearanceAt(p[0], p[2]) - 1e-6)
    }
  })
  it('a flight that starts low between towers never enters one and does not balloon (review focus)', () => {
    const from = { position: [-370, 40, -70], target: [-370, 10, -200] } // a 20 m street in the Loop block
    expect(clearanceAt(-370, -70)).toBe(25)
    const lift = everyFrameClear(from, poseForPlace({ x: 879, z: -578, top: 363 }))
    expect(lift).toBeLessThanOrEqual(1500)
  })
  it('without a heightfield flights are unchanged', () => {
    setHeightfield(grid, null)
    expect(flightLift(A, B)).toBe(0)
    expect(liftAboveRoofs(A)).toEqual(A)
    setHeightfield(grid, fixture())
  })
})
