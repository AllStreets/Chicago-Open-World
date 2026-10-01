// X-0a: hover cards read from a v2 (compact) tile sidecar are identical to the v1 ones, on 50 sampled buildings.
import { describe, it, expect } from 'vitest'
import { encodeTileMeta } from '../../../../shared/tileMeta.js'
import { buildingInfo, tooltipLines } from '../picking.js'
import { fetchTileSidecar } from '../tileSidecar.js'

import v1 from '../../../../pipeline/tests/fixtures/tile-meta-v1.json'
const v2 = JSON.parse(JSON.stringify(encodeTileMeta(v1)))
const landmarks = [{ key: v1.buildings.find((b) => b.hero).hero, name: 'A Landmark', kind: 'tower' }]
const fetchOf = (body) => async () => ({ ok: true, json: async () => body })

describe('tile sidecar (X-0a)', () => {
  it('a v2 sidecar gives the same hover card and info for every sampled building', async () => {
    const meta = await fetchTileSidecar('/world/tiles/x.json', fetchOf(v2))
    expect(v1.buildings).toHaveLength(50)
    v1.buildings.forEach((_, i) => {
      expect(buildingInfo(meta, i, landmarks)).toEqual(buildingInfo(v1, i, landmarks))
      expect(tooltipLines(buildingInfo(meta, i, landmarks))).toEqual(tooltipLines(buildingInfo(v1, i, landmarks)))
    })
  })
  it('trees, props and places arrive in their v1 shape', async () => {
    const meta = await fetchTileSidecar('/world/tiles/x.json', fetchOf(v2))
    expect(meta.trees).toEqual(v1.trees); expect(meta.props).toEqual(v1.props); expect(meta.pois).toEqual(v1.pois)
  })
  it('still reads a v1 sidecar', async () => {
    expect(await fetchTileSidecar('/world/tiles/x.json', fetchOf(v1))).toEqual(v1)
  })
  it('rejects on HTTP errors so callers can retry', async () => {
    await expect(fetchTileSidecar('/x', async () => ({ ok: false, status: 404 }))).rejects.toThrow(/404/)
  })
})
