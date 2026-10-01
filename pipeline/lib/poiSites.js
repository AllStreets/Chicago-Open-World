// pipeline/lib/poiSites.js — every website we can find for a place: its OSM tags first (website, contact:website, url,
// brand:website), then the official website (P856) of its brand or own Wikidata item, fetched once into a cache by
// fetch/fetch-wikidata-sites.js — the build itself never needs the network.
const withScheme = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export function siteFromTags(tags = {}) {
  const raw = tags.website ?? tags['contact:website'] ?? tags.url ?? tags['brand:website']
  return raw ? withScheme(String(raw).split(';')[0].trim()) : null
}

export function wikidataId(tags = {}) {
  const q = tags['brand:wikidata'] ?? tags.wikidata
  return /^Q\d+$/.test(q ?? '') ? q : null
}

// records: { tags, qid } — a missing website is filled from the cache (qid → url | null)
export function mergeSites(records, cache) {
  return records.map((r) => (r.tags?.website || !r.qid || !cache?.[r.qid] ? r : { ...r, tags: { ...r.tags, website: cache[r.qid] } }))
}

// wbgetentities?props=claims → { Qid: url | null }
export function sitesFromEntities(res) {
  const out = {}
  for (const [q, e] of Object.entries(res?.entities ?? {})) out[q] = e?.claims?.P856?.[0]?.mainsnak?.datavalue?.value ?? null
  return out
}
