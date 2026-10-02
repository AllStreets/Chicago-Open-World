// D4-2: the lower streets' names in WorldLabels ("Lower Wacker Dr") show only with U on; the Riverwalk's rooms with U
// on, or when the camera is down by the river.
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { lowerStreetName, lowerStreetLabels, riverwalkRoomLabels, labelPose, LABELS } from '../lowerLabels.js'
import { labelGroups, ROOMS_NEAR } from '../LowerLabels.jsx'
import { setLabels, allLabels } from '../labelRegistry.js'
import { beaconLayout } from '../../lib/labels.js'
import riverwalk from '../../../../pipeline/data/riverwalk.json'

describe('the names people say', () => {
  it.each([
    ['East Lower Wacker Drive', 1, 'Lower Wacker Dr'],
    ['North Lower Michigan Avenue', 1, 'Lower Michigan Ave'],
    ['North Columbus Drive', 1, 'Lower Columbus Dr'],
    ['East Lower North Water Street', 1, 'Lower North Water St'],
    ['East South Water Street', 1, 'Lower South Water St'],
    ['Lower Lower East Randolph Street', 2, 'Lower Lower Randolph St'],
    ['East Wacker Service Drive', 2, 'Lower Lower Wacker Dr'],
    ['Lower Jean Baptiste Point DuSable Lake Shore Drive', 1, 'Lower Lake Shore Dr'],
    ['North Saint Clair Street', 1, 'Lower St Clair St'],
  ])('%s (level %i) → %s', (n, lv, want) => expect(lowerStreetName(n, lv)).toBe(want))
  it('no label for the unnamed and the garage ramps', () => {
    expect(lowerStreetName(null, 1)).toBeNull()
    expect(lowerStreetName('Grant Park North Garage (Entrance)', 1)).toBeNull()
  })
})

const j = {
  y: { 1: -5.1, 2: -9.5 },
  ways: [
    { id: 1, n: 'East Lower Wacker Drive', lv: 1, w: 13, p: [[0, 0, -5.1], [1000, 0, -5.1], [1065, 0, 0.1]] },
    { id: 2, n: 'North Lower Beaubien Court', lv: 1, w: 6, p: [[200, 0, -5.1], [200, 120, -5.1]] },
    { id: 3, n: 'East Lower Wacker Drive', lv: 1, w: 13, p: [[0, 0, -5.1], [0, 20, -5.1]] }, // too short for a label
  ],
}

describe('lowerStreetLabels', () => {
  const L = lowerStreetLabels(j)
  it('labels a street at its level, along its length, the famous ones first', () => {
    const wacker = L.filter((l) => l.text === 'Lower Wacker Dr')
    expect(wacker.length).toBe(1) // one 1 km stretch: its middle (the next would be within gapM)
    expect(wacker[0]).toMatchObject({ kind: 'lower', sub: 'lower level', priority: 3, keepInside: true })
    expect(wacker[0].x).toBeCloseTo(500, 0)
    expect(wacker[0].y).toBeCloseTo(-5.1 + LABELS.liftM, 6)
    const beaubien = L.find((l) => l.text === 'Lower Beaubien Ct')
    expect(beaubien.priority).toBeLessThan(wacker[0].priority)
    expect(beaubien.fadeFar).toBeLessThan(wacker[0].fadeFar) // side streets only once close
    expect(new Set(L.map((l) => l.id)).size).toBe(L.length)
  })
  it('a long street is named again every gapM', () => {
    expect(lowerStreetLabels(j, { gapM: 100 }).filter((l) => l.text === 'Lower Wacker Dr').length).toBe(1)
    const long = { ...j, ways: [...j.ways, { id: 4, n: 'East Lower Wacker Drive', lv: 1, w: 13, p: [[0, 800, -5.1], [600, 800, -5.1]] }] }
    expect(lowerStreetLabels(long).filter((l) => l.text === 'Lower Wacker Dr').length).toBe(2)
  })
  it('a click flies to a view of it', () => {
    const p = labelPose(L[0])
    expect(p.target).toEqual(L[0].at)
    expect(p.position[1]).toBeGreaterThan(30)
  })
})

describe('the Riverwalk’s rooms', () => {
  const bridges = [{ key: 'state', centre: [0, -610] }, { key: 'dearborn', centre: [-126, -608] }]
  const floors = [{ outer: [[-150, -580], [30, -580], [30, -570], [-150, -570]] }]
  it('each room between its bridges, on the Riverwalk floor, at river level', () => {
    const r = riverwalkRoomLabels(riverwalk.rooms, bridges, floors, -5.3)
    const marina = r.find((x) => x.id === 'room:marina')
    expect(marina).toMatchObject({ text: 'Marina Plaza', kind: 'room', sub: 'Riverwalk · State St → Dearborn St' })
    expect(marina.x).toBeGreaterThan(-126); expect(marina.x).toBeLessThan(0)
    expect(marina.z).toBeCloseTo(-575, 0)
    expect(marina.y).toBeCloseTo(-5.3 + 3, 6)
    expect(r.find((x) => x.id === 'room:theater')).toBeUndefined() // its bridges aren't in this list
  })
  it('nothing without the floor (a flat world)', () => {
    expect(riverwalkRoomLabels(riverwalk.rooms, bridges, [], -5.3)).toEqual([])
    expect(riverwalkRoomLabels(riverwalk.rooms, bridges, floors, undefined)).toEqual([])
  })
})

describe('when they show (the label test)', () => {
  afterEach(() => { setLabels('lower', []); setLabels('rooms', []) })
  const rooms = [{ x: 0, z: -575 }]
  it('the lower streets only with U on', () => {
    expect(labelGroups(true, [450, 300, -1050], rooms).streets).toBe(true)
    expect(labelGroups(false, [450, 300, -1050], rooms).streets).toBe(false)
    expect(labelGroups(false, [0, 40, -560], rooms).streets).toBe(false)
  })
  it('the rooms with U on, or low and near them; not from the air', () => {
    expect(labelGroups(true, [5000, 900, 5000], rooms).rooms).toBe(true)
    expect(labelGroups(false, [0, 40, -560], rooms).rooms).toBe(true)
    expect(labelGroups(false, [0, ROOMS_NEAR.belowM + 10, -560], rooms).rooms).toBe(false)
    expect(labelGroups(false, [0, 40, -560 - ROOMS_NEAR.withinM - 50], rooms).rooms).toBe(false)
  })
  it('registered labels lay out with the rest; a two-line label keeps its room; none is cut by the screen edge', () => {
    const L = lowerStreetLabels(j)
    setLabels('lower', L)
    expect(allLabels().filter((l) => l.kind === 'lower').length).toBe(L.length)
    const toScreen = (x) => ({ sx: x === 500 ? 4 : 640, sy: 400, depth: 500, visible: true })
    const out = beaconLayout(allLabels(), { toScreen, width: 1280, height: 800 })
    expect(out.find((o) => o.id === L.find((l) => l.text === 'Lower Wacker Dr').id).labelled).toBe(false) // at the edge
    setLabels('lower', [])
    expect(allLabels().filter((l) => l.kind === 'lower')).toEqual([])
  })
})

const APP = existsSync(`${process.cwd()}/public/world`) ? process.cwd() : `${process.cwd()}/app`
const shipped = `${APP}/public/world/lower-levels.json`
describe.skipIf(!existsSync(shipped))('the shipped lower streets are named', () => {
  it('Lower Wacker, Lower Michigan, Lower Columbus, Lower Randolph and Lower Lower Wacker', () => {
    const names = new Set(lowerStreetLabels(JSON.parse(readFileSync(shipped, 'utf8'))).map((l) => l.text))
    for (const n of ['Lower Wacker Dr', 'Lower Michigan Ave', 'Lower Columbus Dr', 'Lower Randolph Dr', 'Lower Lower Wacker Dr']) expect(names).toContain(n)
  })
})
