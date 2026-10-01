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
  stadiums: ['way["leisure"="stadium"]', 'relation["leisure"="stadium"]'],
  rail: ['way["railway"~"^(subway|light_rail|rail)$"]'],
  water: ['relation["water"="river"]', 'way["water"="river"]', 'way["waterway"="canal"]["area"]', 'way["water"="canal"]', 'way["water"="harbour"]', 'relation["water"="harbour"]',
    'way["natural"="water"]', 'relation["natural"="water"]["water"~"^(lagoon|pond|basin|reservoir)$"]'],
  shore: ['way["man_made"~"^(breakwater|groyne)$"]'],
  // the Great Lakes are mapped as a natural=water relation, not coastline: take its shoreline member ways
  coast: ['rel["natural"="water"]["name"="Lake Michigan"];way(r)'],
  // plazas and park paths (user, 2026-09-30): pedestrian areas and squares, and footways/paths that aren't street
  // sidewalks (lib/paving.js sorts brick from concrete)
  paving: ['way["highway"="pedestrian"]', 'way["area:highway"]', 'way["place"="square"]', 'relation["place"="square"]',
    'way["highway"~"^(footway|path|steps)$"]["footway"!~"^(sidewalk|crossing|traffic_island)$"]'],
}

// Transit (V3): route relations with their member tracks + stop nodes; stations and platforms.
const QUERIES = {
  routes: (bb) => `[out:json][timeout:180];relation["type"="route"]["route"~"^(subway|light_rail|train)$"]${bb}->.r;.r out body;way(r.r)${bb};out geom;node(r.r)${bb};out;`,
  // Places (P4 · I-4.1): named amenities, tourism, shops and leisure — centres and tags only (lib/pois.js sorts them)
  pois: (bb) => `[out:json][timeout:180];(${['node', 'way', 'relation'].flatMap((t) => [
    `${t}[name][amenity~"^(restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|cafe|ice_cream|theatre|cinema|arts_centre|music_venue|events_venue|library|marketplace|pharmacy|bank|hospital|clinic|post_office|community_centre)$"]`,
    `${t}[name][tourism~"^(museum|gallery|attraction|hotel|viewpoint)$"]`, `${t}[name][shop]`, `${t}[name][leisure~"^(park|playground|sports_centre|fitness_centre|marina)$"]`,
  ]).map((x) => x + bb + ';').join('')});out center tags;`,
  stations: (bb) => `[out:json][timeout:180];(node["railway"="station"]${bb};way["railway"="station"]${bb};node["public_transport"="station"]${bb};way["railway"="platform"]${bb};way["public_transport"="platform"]["train"="yes"]${bb};way["public_transport"="platform"]["subway"="yes"]${bb};);out geom;`,
}

export function overpassQuery(kind, { s, w, n, e }) {
  const bb = `(${s},${w},${n},${e})`
  if (QUERIES[kind]) return QUERIES[kind](bb)
  const f = FILTERS[kind]
  if (!f) throw new Error(`unknown overpass kind: ${kind}`)
  return `[out:json][timeout:180];(${f.map((x) => x + bb + ';').join('')});${kind === 'trees' ? 'out;' : 'out geom;'}`
}

// chunk grid per kind for the world fetch (nx × ny sub-boxes)
export const FETCH_KINDS = { allbuildings: [6, 8], parts: [2, 3], water: [2, 3], parks: [2, 3], roads: [3, 4], trees: [2, 3], rail: [2, 3], stadiums: [1, 1], shore: [2, 3], coast: [1, 2], routes: [1, 1], stations: [1, 1], pois: [3, 4], paving: [3, 4] }
