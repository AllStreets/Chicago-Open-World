// app/src/lib/tileSidecar.js — fetch a tile's sidecar (buildings, trees, roof props, places) and hand it back in
// the v1 shape whatever the file's version: v2 is the compact columnar form (X-0a, shared/tileMeta.js).
import { decodeTileMeta } from '../../../shared/tileMeta.js'

export async function fetchTileSidecar(url, fetchImpl = fetch) {
  const r = await fetchImpl(url)
  if (!r.ok) throw new Error(`tile sidecar HTTP ${r.status}`)
  return decodeTileMeta(await r.json())
}
