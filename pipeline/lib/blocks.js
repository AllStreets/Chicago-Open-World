// pipeline/lib/blocks.js — 2 km far-detail blocks: the LOD1 content of up to 16 tiles in one file.
// _BLDG stays unique inside a block: each tile's indices are shifted by the buildings of the tiles before it,
// and blocks/<bk>.json maps a block _BLDG back to (tile key, tile-local index) for picking.
export function createBlock() {
  return {
    b: { positions: [], normals: [], uvs: [], fac: [], seed: [], bldg: [] },
    g: { positions: [], normals: [], uvs: [], layer: [] },
    w: { positions: [], normals: [], uvs: [], calm: [] },
    tiles: [], count: 0,
  }
}

export function addTileToBlock(B, key, { buildings, ground, water, count }) {
  const base = B.count
  for (const k of ['positions', 'normals', 'uvs']) {
    for (const v of buildings[k]) B.b[k].push(v)
    for (const v of ground[k]) B.g[k].push(v)
    for (const v of water[k]) B.w[k].push(v)
  }
  for (const v of buildings.fac) B.b.fac.push(v)
  for (const v of buildings.seed) B.b.seed.push(v)
  for (const v of buildings.bldg) B.b.bldg.push(v + base)
  for (const v of ground.extra?.LAYER ?? []) B.g.layer.push(v)
  for (const v of water.extra?.CALM ?? []) B.w.calm.push(v)
  B.tiles.push({ key, base, count })
  B.count += count
}

export function blockLayers(B) {
  return {
    buildings: { positions: B.b.positions, normals: B.b.normals, uvs: B.b.uvs, extra: { FACADE: new Float32Array(B.b.fac), SEED: new Float32Array(B.b.seed), BLDG: new Float32Array(B.b.bldg) } },
    ground: { positions: B.g.positions, normals: B.g.normals, uvs: B.g.uvs, extra: { LAYER: new Float32Array(B.g.layer) } },
    water: { positions: B.w.positions, normals: B.w.normals, uvs: B.w.uvs, extra: { CALM: new Float32Array(B.w.calm) } },
  }
}

export const blockSidecar = (B) => ({ tiles: B.tiles })
