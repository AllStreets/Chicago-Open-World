// pipeline/tests/lpTour.test.js — B-9: the "Lincoln Park, South to North" VISIT tour. Eight stops, south → north, each
// a shipped landmark, and every pose passes poseClearance against the built roof heightfield (camera ≥ roof + 25 m,
// and nothing taller than the sightline stands between the camera and its landmark). Skipped without a built world.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import sharp from 'sharp'

const APP = new URL('../../app/', import.meta.url)
const tours = JSON.parse(readFileSync(new URL('src/data/tours.json', APP), 'utf8'))
const WORLD = new URL('public/world/', APP)
const ready = existsSync(new URL('manifest.json', WORLD))
const CLEAR_M = 25 // app/src/lib/poseClearance.js

describe('the Lincoln Park tour (B-9)', () => {
  const t = tours.find((x) => x.id === 'lincolnpark')
  it('eight stops with card text, from Lincoln at North Avenue to the Waveland Clock Tower', () => {
    expect(t.stops).toHaveLength(8)
    for (const s of t.stops) { expect(s.text.length).toBeGreaterThan(60); expect(s.pose.position).toHaveLength(3) }
    const z = t.stops.map((s) => s.pose.target[2])
    for (let i = 1; i < z.length; i++) expect(z[i], t.stops[i].title).toBeLessThan(z[i - 1] + 250) // south → north (−z), allowing the beach's step east
    expect(t.stops[0].landmark).toBe('lincolnstatues'); expect(t.stops.at(-1).landmark).toBe('wavelandclock')
  })
  it.skipIf(!ready)('every stop is a shipped landmark, framed from within 300 m, and its pose clears the roofs', async () => {
    const m = JSON.parse(readFileSync(new URL('manifest.json', WORLD), 'utf8')), hf = m.heightfield
    const { data } = await sharp(new URL(hf.file, WORLD).pathname).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const roof = (x, z) => { let mx = 0; const fx = (x - hf.minX) / hf.cell - 0.5, fz = (z - hf.minZ) / hf.cell - 0.5; for (let j = Math.floor(fz); j <= Math.floor(fz) + 1; j++) for (let i = Math.floor(fx); i <= Math.floor(fx) + 1; i++) { const k = (j * hf.width + i) * 4; mx = Math.max(mx, (data[k] << 8) | data[k + 1]) } return mx * hf.scale }
    for (const s of t.stops) {
      const lm = m.landmarks.find((l) => l.key === s.landmark)
      expect(lm, s.landmark).toBeTruthy()
      const [px, py, pz] = s.pose.position, [tx, ty, tz] = s.pose.target
      expect(Math.hypot(tx - lm.x, tz - lm.z), s.title).toBeLessThan(20)
      expect(Math.hypot(px - tx, pz - tz), s.title).toBeLessThan(300)
      expect(py, `${s.title} clears its roof`).toBeGreaterThanOrEqual(roof(px, pz) + CLEAR_M)
      for (let k = 1; k < 10; k++) { const f = k / 10, x = px + (tx - px) * f, z = pz + (tz - pz) * f, y = py + (ty - py) * f; if (Math.hypot(x - tx, z - tz) > 35) expect(roof(x, z), `${s.title} sightline at ${f}`).toBeLessThan(y) }
    }
  })
})
