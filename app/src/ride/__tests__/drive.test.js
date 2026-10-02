// app/src/ride/__tests__/drive.test.js — D3-3: the Lower Wacker drive in Ride mode — Columbus → Lower Wacker → the Lake St
// exit, from the front of a bus, at the roadway's height; ⌘K "Drive Lower Wacker" finds it.
import { describe, it, expect } from 'vitest'
import RIDES from '../../data/rides.json'
import { driveRides, RIDE_KINDS, VIEWS, DRIVE_MPS } from '../rideCatalog.js'
import { createRun, stepRun, runState, ridePose, EYE_M } from '../rideRun.js'
import { pointAt } from '../../transit/path.js'
import { searchPlaces } from '../../lib/places.js'
import { rideCommands } from '../../lib/paletteSources.js'

const drive = driveRides(RIDES).find((r) => r.id === 'drive:lower-wacker')

describe('the Lower Wacker drive (D3-3)', () => {
  it('is a ride of its own kind, in the cab of a bus', () => {
    expect(drive).toBeTruthy()
    expect(drive.kind).toBe('drive'); expect(VIEWS.drive).toEqual(['cab'])
    expect(RIDE_KINDS.map((k) => k[0])).toContain('drive')
    expect(drive.name).toMatch(/Lower Wacker/)
  })
  it('starts on the street, goes down to Lower Wacker and comes up again at Lake St', () => {
    const ys = drive.path.pts.map((p) => p[1])
    expect(ys[0]).toBeGreaterThan(0); expect(ys.at(-1)).toBeGreaterThan(-0.5)
    expect(Math.min(...ys)).toBeCloseTo(-5.1, 1)
    // most of it is under the street
    let under = 0
    for (let s = 0; s < drive.path.length; s += 10) if (pointAt(drive.path, s).p[1] < -4) under += 10
    expect(under / drive.path.length).toBeGreaterThan(0.75)
    expect(drive.stops[0].name).toMatch(/Columbus/); expect(drive.stops.at(-1).name).toMatch(/Lake St/)
    expect(drive.stops.some((s) => /Lower Wacker/.test(s.name))).toBe(true)
  })
  it('the cab eye rides 2.4 m over the roadway all the way, under the 4.19 m clearance', () => {
    let run = createRun(drive)
    const dur = drive.path.length / DRIVE_MPS
    for (let t = 0; t < dur; t += 5) {
      const st = runState(drive, run), pose = ridePose(drive, st, 'cab')
      expect(pose.position[1] - st.head.p[1]).toBeCloseTo(EYE_M.drive, 0)
      expect(pose.position[1] - st.head.p[1]).toBeLessThan(4.19)
      run = stepRun(drive, run, 0.25); run = { ...run, tau: run.tau + 4.75 }
    }
  })
  it('⌘K "Drive Lower Wacker" finds it first', () => {
    const cmds = rideCommands()
    const hit = searchPlaces('Drive Lower Wacker', cmds)[0]
    expect(hit?.id).toBe('ride:drive:lower-wacker')
    expect(hit.name).toMatch(/^Drive: Lower Wacker/)
  })
})
