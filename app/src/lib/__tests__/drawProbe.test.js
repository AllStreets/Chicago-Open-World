// app/src/lib/__tests__/drawProbe.test.js
import { describe, it, expect } from 'vitest'
import { createDrawProbe } from '../drawProbe.js'
const fakeInfo = () => ({ autoReset: true, render: { calls: 0, triangles: 0 }, reset() { this.render.calls = 0; this.render.triangles = 0 } })

describe('draw probe', () => {
  it('counts every pass of a frame (composer passes accumulate while autoReset is off)', () => {
    const info = fakeInfo(), p = createDrawProbe(info)
    p.start()
    expect(info.autoReset).toBe(false)
    info.render.calls += 700; info.render.triangles += 2e6   // scene + shadow pass
    info.render.calls += 6; info.render.triangles += 12      // post passes
    expect(p.frame()).toEqual({ calls: 706, triangles: 2000012 })
    expect(info.render.calls).toBe(0)                         // reset once per frame
  })
  it('stats: average and max calls over the window, fps from frame times', () => {
    const info = fakeInfo(), p = createDrawProbe(info, 3)
    p.start()
    for (const c of [100, 200, 300, 400]) { info.render.calls = c; p.frame(); p.tick(1 / 50) }
    expect(p.stats()).toMatchObject({ calls: 300, maxCalls: 400, frames: 3, fps: 50 })
  })
  it('stop() restores autoReset', () => {
    const info = fakeInfo(), p = createDrawProbe(info)
    p.start(); p.stop()
    expect(info.autoReset).toBe(true)
  })
})
