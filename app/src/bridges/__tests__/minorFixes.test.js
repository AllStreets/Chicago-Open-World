// Deferred minors from the V4–V6 reviews, each pinned.
import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { liftState, LIFT_DEMO, MAX_LIFT_DEG } from '../lift.js'
import { patchFacadeShader } from '../../world/materials/facadeMaterial.js'
import { createRumble } from '../../audio/rumble.js'

const order = ['a', 'b']
describe('deferred review minors', () => {
  it('V6 #6: stopping a lift mid-way lowers the leaves smoothly, then ends', () => {
    const t0 = 0, stop = 40000
    const at = (now) => liftState({ now, manualStart: t0, manualStop: stop, order })
    const up = liftState({ now: stop, manualStart: t0, order }).angles.a
    expect(up).toBeGreaterThan(0.5)
    expect(at(stop + 1000).angles.a).toBeGreaterThan(0)           // no snap to 0
    expect(at(stop + 1000).angles.a).toBeLessThanOrEqual(up + 1e-9)
    expect(at(stop + LIFT_DEMO.lowerS * 1000 + 10)).toMatchObject({ done: true, angles: {} })
    for (let t = stop; t < stop + 30000; t += 997) expect(at(t).angles.a ?? 0).toBeLessThanOrEqual((MAX_LIFT_DEG * Math.PI) / 180 + 1e-9)
  })
  it('V6 #5: styleBase never reads outside the loaded palette (stone grey, not black)', () => {
    const s = patchFacadeShader({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} })
    expect(s.fragmentShader).toMatch(/vec3 styleBase\(float style\) \{[^}]*uStyleRows/)
  })
  it('V4 #6: the clatter gain has a base under the LFO, so the rail joints pulse', () => {
    const param = () => ({ value: 0, setTargetAtTime: vi.fn() })
    const node = () => ({ connect: vi.fn((n) => n), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: param(), gain: param(), Q: param(), type: '', buffer: null, loop: false })
    const gains = []
    const ctx = { sampleRate: 8000, currentTime: 0, destination: node(), createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: node, createBiquadFilter: node, createOscillator: node, createGain: () => { const g = node(); gains.push(g); return g } }
    createRumble(ctx).set(0.8, 2)
    const targets = gains.map((g) => g.gain.setTargetAtTime.mock.calls.map((c) => c[0]))
    // clack base (level·0.15) and LFO depth (level·0.15) both set: the gain swings 0 … 2A instead of ±A
    expect(targets.filter((t) => t.length && Math.abs(t[0] - 0.12) < 1e-9).length).toBeGreaterThanOrEqual(2)
  })
})
