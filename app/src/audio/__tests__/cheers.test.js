import { describe, it, expect, beforeEach } from 'vitest'
import { createCheers, cheer } from '../cheers.js'
import { useSports } from '../../sports/sportsStore.js'

let made = 0
class Param { constructor(v = 0) { this.value = v } setTargetAtTime(v) { this.value = v } }
class Node { constructor(kind) { this.kind = kind } connect(n) { return n } }
class FakeCtx {
  constructor() {
    made++; this.sampleRate = 8000; this.currentTime = 0; this.state = 'suspended'; this.suspends = 0; this.nodes = []
    this.destination = new Node('dest')
    this.listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map((k) => [k, new Param()]))
  }
  track(n) { this.nodes.push(n); return n }
  createGain() { const n = new Node('gain'); n.gain = new Param(1); return this.track(n) }
  createBuffer(_c, n) { const d = new Float32Array(n); return { getChannelData: () => d } }
  createBufferSource() { const n = new Node('src'); n.start = () => { n.started = true }; n.stop = () => {}; return this.track(n) }
  createBiquadFilter() { const n = new Node('filter'); n.frequency = new Param(); n.Q = new Param(); return this.track(n) }
  createPanner() { const n = new Node('panner'); n.positionX = new Param(); n.positionY = new Param(); n.positionZ = new Param(); return this.track(n) }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.suspends++; this.state = 'suspended'; return Promise.resolve() }
  close() {}
}

describe('cheers engine', () => {
  beforeEach(() => { made = 0 })
  it('creates no AudioContext until enabled and suspends on disable', async () => {
    const c = createCheers(FakeCtx)
    c.setListener([0, 10, 0], [0, 0, -1]); c.setVenue('wrigleyfield', [0, 15, 0], 0.28, 1)
    expect(made).toBe(0); expect(c.created).toBe(false)
    await c.enable()
    expect(made).toBe(1)
    c.disable()
    expect(c.created).toBe(true)
  })
  it('a live venue gets a looping, positional voice with the inverse distance model', async () => {
    const c = createCheers(FakeCtx); await c.enable()
    c.setVenue('unitedcenter', [0, 15, 0], 0, 0)       // idle: no voice
    c.setVenue('wrigleyfield', [-2292, 15, -7339], 0.28, 0)
    const ctx = c._ctx
    const p = ctx.nodes.filter((n) => n.kind === 'panner')
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ distanceModel: 'inverse', refDistance: 80, maxDistance: 1500, rolloffFactor: 1.1, panningModel: 'equalpower' })
    expect(p[0].positionX.value).toBe(-2292)
    expect(ctx.nodes.find((n) => n.kind === 'src')).toMatchObject({ loop: true, started: true })
    c.disable(); expect(ctx.suspends).toBe(1)
  })
  it('cheer() (Phase 5) pushes a swell for the venue', () => {
    cheer('soldierfield', 0.8)
    expect(useSports.getState().swells.soldierfield).toMatchObject({ strength: 0.8 })
  })
})

describe('cheers share the one sound context', () => {
  it('a shared context is used as-is and never closed by dispose', async () => {
    const { createCheers } = await import('../cheers.js')
    const node = () => ({ connect: (n) => n, gain: { value: 0 } })
    const ctx = { sampleRate: 8000, currentTime: 0, destination: {}, createGain: node, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), resume: () => {}, suspend: () => {}, closed: 0, close() { this.closed++ } }
    const c = createCheers(() => ctx, { shared: true })
    c.enable()
    expect(c._ctx).toBe(ctx)
    c.dispose()
    expect(ctx.closed).toBe(0)
  })
})
