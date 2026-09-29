// pipeline/lib/manifest.js — world manifest constants and reproducible build output.
export const MANIFEST_VERSION = 5

// A timestamp only when asked for (CHI_BUILD_STAMP=1): two builds of the same cache are byte-identical.
export function manifestStamp(env = process.env, now = () => new Date()) {
  return env.CHI_BUILD_STAMP === '1' ? { generatedAt: now().toISOString() } : {}
}

// readdirSync order is filesystem-dependent: read cache chunks by kind prefix, then numeric chunk index.
export function sortCacheFiles(names, prefix) {
  const idx = (f) => Number(f.slice(prefix.length).replace(/\.json$/, ''))
  return names.filter((f) => f.startsWith(prefix)).sort((a, b) => idx(a) - idx(b))
}
