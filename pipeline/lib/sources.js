// pipeline/lib/sources.js — every external URL/query the pipeline uses.
export const RING0_BBOX = { s: 41.8650, w: -87.6450, n: 41.9000, e: -87.6050 }
export const WORLD_BBOX = { s: 41.826, w: -87.695, n: 41.952, e: -87.595 }

export function chunkBBox({ s, w, n, e }, nx, ny) {
  const out = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    out.push({ s: s + ((n - s) * j) / ny, n: s + ((n - s) * (j + 1)) / ny, w: w + ((e - w) * i) / nx, e: w + ((e - w) * (i + 1)) / nx })
  return out
}

export const USER_AGENT = 'chi-atlas-open-world/0.1 (github.com/AllStreets/Chicago-Open-World)'

export function footprintsUrl({ s, w, n, e }, offset, limit) {
  const u = new URL('https://data.cityofchicago.org/resource/syp8-uezg.json')
  u.searchParams.set('$where', `within_box(the_geom,${n},${w},${s},${e})`)
  u.searchParams.set('$order', 'bldg_id')
  u.searchParams.set('$limit', String(limit))
  u.searchParams.set('$offset', String(offset))
  return u.toString()
}

export const cityBoundaryUrl = () => 'https://data.cityofchicago.org/resource/qqq8-j68g.geojson'

const FILTERS = {
  allbuildings: ['way["building"]', 'relation["building"]["type"="multipolygon"]'],
  buildings: ['way["building"]["height"]', 'way["building"]["building:levels"]'],
  parts: ['way["building:part"]', 'relation["building:part"]'],
  parks: ['way["leisure"~"^(park|garden|playground|pitch)$"]', 'relation["leisure"="park"]', 'way["landuse"~"^(grass|recreation_ground|village_green)$"]', 'way["natural"="beach"]'],
  roads: ['way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|motorway_link|trunk_link|primary_link|secondary_link)$"]'],
  trees: ['node["natural"="tree"]'],
  rail: ['way["railway"~"^(subway|light_rail|rail)$"]'],
  water: ['relation["water"="river"]', 'way["water"="river"]', 'way["waterway"="canal"]["area"]', 'way["water"="canal"]', 'way["water"="harbour"]', 'relation["water"="harbour"]'],
}

export function overpassQuery(kind, { s, w, n, e }) {
  const f = FILTERS[kind]
  if (!f) throw new Error(`unknown overpass kind: ${kind}`)
  const bb = `(${s},${w},${n},${e})`
  return `[out:json][timeout:180];(${f.map((x) => x + bb + ';').join('')});${kind === 'trees' ? 'out;' : 'out geom;'}`
}
