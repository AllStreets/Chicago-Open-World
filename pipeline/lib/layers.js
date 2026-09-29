// pipeline/lib/layers.js — the per-tile building layer: geometry plus per-vertex façade, seed, building index, style.
export const bAcc = () => ({ positions: [], normals: [], uvs: [], fac: [], seed: [], bldg: [], style: [] })

export function appendBuilding(dst, m, facade, seed, idx, style = 0) {
  for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) dst[k].push(v)
  const n = m.positions.length / 3
  for (let v = 0; v < n; v++) { dst.fac.push(facade); dst.seed.push(seed); dst.bldg.push(idx); dst.style.push(style) }
}

export function appendLayer(dst, src) {
  for (const k of ['positions', 'normals', 'uvs', 'fac', 'seed', 'bldg', 'style']) for (const v of src[k]) dst[k].push(v)
}

export const asLayer = (b) => ({
  positions: b.positions, normals: b.normals, uvs: b.uvs,
  extra: { FACADE: new Float32Array(b.fac), SEED: new Float32Array(b.seed), BLDG: new Float32Array(b.bldg), STYLE: new Float32Array(b.style) },
})
