// app/src/lib/manifest.js — never-throwing world manifest loader.
export async function loadManifest(fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/world/manifest.json')
    if (!r.ok) return { ok: false, error: `manifest HTTP ${r.status}` }
    const m = await r.json()
    if (!m || !Array.isArray(m.tiles) || !m.ground) return { ok: false, error: 'manifest malformed' }
    return { ok: true, manifest: m }
  } catch (e) {
    return { ok: false, error: `manifest ${e.message}` }
  }
}
