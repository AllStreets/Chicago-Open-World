// app/src/traffic/__tests__/lowerTraffic.test.js — D3: traffic on Chicago's lower levels (Lower Wacker & co) and the
// raised-bridge holds. traffic.bin v2 heights, yAt along a ramp, lanes clear of the deck columns, the deep links only
// while the decks are drawn, and vehicles waiting for a bascule.
import { describe, it, expect } from 'vitest'
import { decodeRoadGraph, buildNetwork, yAt, pointOnLink, deckLaneOffsets, DECK, bridgeCrossings, closedBridges, deckHides, hiddenAt } from '../graph.js'
import { createTraffic, TYPES, LOWER_SHARE } from '../sim.js'

const LOW = -5.22 // Lower Wacker's roadway over the street's road ribbon (LOWER_Y −5.1 − 0.12)

// v2: a street 0–1 (200 m east), a ramp 1–2 (65 m, down at 8 %) and Lower Wacker 2–3 (300 m) on to node 3
function rampNet() {
  const nodes = [[-200, 0], [0, 0], [100, 0], [400, 0]]
  const enc = [2, nodes.length, ...nodes.flat(),
    2, 2, Math.round(LOW * 100), 3, Math.round(LOW * 100), // lifted nodes
    3,
    0, 1, 3, 2, 0, 0, // the street: secondary, one-way, no interior points
    1, 2, 3 | 8, 2, 0, 1, 99, 65, 0, Math.round(LOW * 100), // the ramp: a knee at 65 m, deck 9.9 m
    2, 3, 1 | 8, 2, 0, 0, 99] // Lower Wacker: trunk, one-way
  return decodeRoadGraph(new Int16Array(enc))
}

describe('traffic.bin v2 (D3-1)', () => {
  it('reads the heights and the deck width; v1 files still parse', () => {
    const g = rampNet()
    expect(g.edges[1].ys.map((y) => +y.toFixed(2))).toEqual([0, LOW, LOW])
    expect(g.edges[1].w).toBeCloseTo(9.9)
    expect(g.edges[0].ys).toBeNull()
    const v1 = decodeRoadGraph(new Int16Array([1, 2, 0, 0, 100, 0, 1, 0, 1, 2, 1, 1, 0]))
    expect(v1.edges[0].pts).toEqual([[0, 0], [100, 0]]); expect(v1.edges[0].ys).toBeNull(); expect(v1.nodeY[1]).toBe(0)
  })
  it('yAt: 0 on the street, falling down the ramp to the deck, level along it', () => {
    const net = buildNetwork(rampNet())
    const ramp = net.links.find((l) => l.from === 1), deck = net.links.find((l) => l.from === 2), street = net.links.find((l) => l.from === 0)
    expect(yAt(street, 50)).toBe(0)
    expect(yAt(ramp, 0)).toBeCloseTo(0)
    expect(yAt(ramp, 32.5)).toBeCloseTo(LOW / 2, 2)
    expect(yAt(ramp, 80)).toBeCloseTo(LOW, 2)
    expect(pointOnLink(ramp, 32.5, 0).y).toBeCloseTo(LOW / 2, 2)
    expect(pointOnLink(ramp, 32.5, 0).grade).toBeCloseTo(LOW / 65, 3)
    expect(ramp.lower && !ramp.deep).toBe(true); expect(deck.deep).toBe(true)
    expect(net.signals.length).toBe(0) // no lights under the street
  })
})

describe('lanes on a lower deck clear of its walls and columns (D3-2)', () => {
  const D = DECK
  for (const [w, lanes, twoWay] of [[6.6, 2, false], [9.9, 3, false], [12, 1, true], [13.2, 4, false], [14, 2, true], [16.5, 5, false], [5, 1, false], [10, 2, true]]) {
    it(`${w} m, ${lanes} lane(s)${twoWay ? ' each way' : ''}`, () => {
      const off = deckLaneOffsets(w, lanes, twoWay), half = w / 2
      expect(off.length).toBeGreaterThan(0)
      const cols = w >= D.colMinW ? [half - D.colIn, -(half - D.colIn), ...(w >= D.midColW ? [0] : [])] : []
      for (const o of off) {
        for (const c of cols) expect(Math.abs(o - c)).toBeGreaterThanOrEqual(D.colHalf + D.vehHalf) // a truck's side never meets a column
        expect(Math.abs(o) + D.vehHalf).toBeLessThanOrEqual(half + D.wallPad) // nor the wall
        if (twoWay) expect(o - D.vehHalf).toBeGreaterThanOrEqual(0) // nor the oncoming lane
      }
      for (let i = 1; i < off.length; i++) expect(Math.abs(off[i] - off[i - 1])).toBeGreaterThanOrEqual(2 * D.vehHalf) // side by side
    })
  }
})

describe('the traffic sim on the lower levels', () => {
  it('vehicles ride down the ramp at its height and on along the deck', () => {
    const net = buildNetwork(rampNet()), sim = createTraffic(net, { seed: 5, cap: 50 })
    sim.refresh(0, 0, 8)
    let sawRamp = false
    for (let k = 0; k < 600; k++) {
      sim.step(0.1)
      for (const v of sim.vehicles) {
        const mid = Math.min(v.s, v.link.len) - TYPES[v.type].length / 2
        expect(v.y).toBeCloseTo(yAt(v.link, mid), 1)
        if (v.link.from === 1 && v.y < -1 && v.y > LOW + 1) { sawRamp = true; expect(v.pitch).toBeLessThan(-0.05) }
      }
    }
    expect(sawRamp).toBe(true)
  })
  it('the deck under the street carries none while the lower levels are not drawn; the ramp keeps its own', () => {
    const net = buildNetwork(rampNet()), sim = createTraffic(net, { seed: 2, cap: 80 })
    sim.refresh(0, 0, 8, false)
    expect(sim.vehicles.some((v) => v.link.deep)).toBe(false)
    expect([...sim.active].some((id) => net.links[id].from === 1)).toBe(true)
    sim.refresh(0, 0, 8, true)
    expect(sim.vehicles.some((v) => v.link.deep)).toBe(true)
    // seen from down there: only the deck near the camera
    sim.refresh(0, 0, 8, { x: -1500, z: 0, r: 300 })
    expect(sim.vehicles.some((v) => v.link.deep)).toBe(false)
    sim.refresh(0, 0, 8, { x: 250, z: 0, r: 300 })
    expect(sim.vehicles.some((v) => v.link.deep)).toBe(true)
  })
  it('the lower decks have room of their own over the cap, so a full street level never leaves them empty', () => {
    const net = buildNetwork(rampNet()), sim = createTraffic(net, { seed: 4, cap: 5 })
    sim.refresh(0, 0, 8, true)
    expect(sim.vehicles.length).toBeGreaterThan(5); expect(sim.vehicles.length).toBeLessThanOrEqual(5 + Math.round(5 * LOWER_SHARE))
    expect(sim.vehicles.some((v) => v.link.lower)).toBe(true)
  })
  it('a ramp stretch the deck mesh leaves out (inside another roadway) is hidden; the level deck never is', () => {
    const net = buildNetwork(rampNet())
    // the deck drawn: the ramp's lower half and Lower Wacker (its upper half left out, as hideThroughDecks would)
    deckHides(net, [{ w: 9.9, p: [[32.5, 0, LOW / 2 + 0.12], [65, 0, LOW + 0.12], [400, 0, LOW + 0.12]] }], 0.12)
    const ramp = net.links.find((l) => l.from === 1), deck = net.links.find((l) => l.from === 2)
    expect(hiddenAt(ramp, 20)).toBe(true); expect(hiddenAt(ramp, 50)).toBe(false)
    expect(deck.hide).toBeNull()
  })
})

describe('raised bridges (bug: traffic drove onto raised bascule leaves)', () => {
  // a street 0 → 1 → 2 → 3 east; the bridge way 1–2 (70 m) over the river, its leaves centred at x = 335
  function bridgeNet() {
    const nodes = [[0, 0], [300, 0], [370, 0], [700, 0]]
    const enc = [1, 4, ...nodes.flat(), 3, 0, 1, 3, 2, 0, 0, 1, 2, 3, 2, 0, 0, 2, 3, 3, 2, 0, 0]
    return bridgeCrossings(buildNetwork(decodeRoadGraph(new Int16Array(enc))), [{ key: 'test', centre: [335, 0], axis: [1, 0], span: 66 }])
  }
  it('finds the leaves on the bridge link and holds the approach short of them', () => {
    const net = bridgeNet(), app = net.links.find((l) => l.from === 0), br = net.links.find((l) => l.from === 1)
    expect(br.spans[0].key).toBe('test'); expect(br.spans[0].s0).toBeLessThan(4)
    const h = app.holds.find((x) => x.key === 'test')
    expect(h.via.has(br)).toBe(true); expect(h.at).toBeGreaterThan(app.len - 6)
  })
  it('closed a little before the leaves move and while they are up', () => {
    const T = { raiseS: 14, holdS: 40, lowerS: 14, staggerS: 2.5 }
    expect(closedBridges({ angles: {}, elapsed: -5, order: ['a', 'b'], T }).has('a')).toBe(true) // gates down 10 s ahead
    expect(closedBridges({ angles: {}, elapsed: -20, order: ['a'], T }).size).toBe(0)
    expect(closedBridges({ angles: { a: 0.3 }, elapsed: null }).has('a')).toBe(true)
    expect(closedBridges({ angles: {}, elapsed: 100, order: ['a'], T }).size).toBe(0) // the run is over
  })
  it('nobody drives onto the leaves while the bridge is up, and traffic flows again when it is down', () => {
    const net = bridgeNet(), sim = createTraffic(net, { seed: 9, cap: 60 }), br = net.links.find((l) => l.from === 1)
    sim.refresh(300, 0, 8)
    sim.setBridges(new Set(['test']), new Set(['test']))
    let waited = 0
    for (let k = 0; k < 900; k++) {
      sim.step(0.1)
      for (const v of sim.vehicles) if (v.link === br) expect(v.s - TYPES[v.type].length).toBeGreaterThan(br.spans[0].s1) // never on the leaves
      waited = Math.max(waited, sim.vehicles.filter((v) => v.link.from === 0 && v.v < 0.3).length)
    }
    expect(waited).toBeGreaterThan(0) // a queue stood at the bridge
    sim.setBridges(new Set(), new Set())
    let crossed = 0
    for (let k = 0; k < 600; k++) { sim.step(0.1); crossed = Math.max(crossed, sim.vehicles.filter((v) => v.link === br).length) }
    expect(crossed).toBeGreaterThan(0)
  })
})
