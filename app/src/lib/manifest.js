// app/src/lib/manifest.js — never-throwing world manifest loader.
export const DEFAULT_GROUND = { land: 'ground/land.glb', river: 'ground/river.glb' }
export const groundFiles = (manifest) => manifest?.ground ?? DEFAULT_GROUND

export async function loadManifest(fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/world/manifest.json')
    if (!r.ok) return { ok: false, error: `manifest HTTP ${r.status}` }
    const m = await r.json()
    if (!m || !Array.isArray(m.tiles) || !(m.ground || m.land)) return { ok: false, error: 'manifest malformed' }
    return { ok: true, manifest: m }
  } catch (e) {
    return { ok: false, error: `manifest ${e.message}` }
  }
}
// Every world file is fetched with the manifest version: a format bump never mixes cached old tiles with new ones.
export const worldUrl = (file, version) => `/world/${file}${version ? `?v=${version}` : ''}`
