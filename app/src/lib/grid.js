// app/src/lib/grid.js — Chicago's address grid ↔ world metres.
// 800 address numbers = 1 mile. Origin: State (0 E/W) & Madison (0 N/S).
export const M_PER_NUMBER = 1609.344 / 800

// Signed address numbers: +E / -W for north-south streets, +N / -S for east-west streets.
const NS_STREETS = [ // streets that run north-south, keyed by E/W number
  [-2400, 'WESTERN'], [-2000, 'DAMEN'], [-1600, 'ASHLAND'], [-1200, 'RACINE'], [-1000, 'MORGAN'], [-800, 'HALSTED'], [-600, 'JEFFERSON'], [-500, 'CANAL'],
  [-400, 'RIVERSIDE'], [-360, 'WACKER'], [-300, 'FRANKLIN'], [-200, 'WELLS'], [-140, 'LASALLE'],
  [-100, 'CLARK'], [-36, 'DEARBORN'], [0, 'STATE'], [45, 'WABASH'], [100, 'MICHIGAN'],
  [200, 'COLUMBUS'], [300, 'MCCLURG'], [400, 'LAKE SHORE'], [600, 'LAKE SHORE'],
]
const EW_STREETS = [ // streets that run east-west, keyed by N/S number
  [-3500, '35TH'], [-3100, '31ST'], [-2600, '26TH'], [-2200, 'CERMAK'], [-1800, '18TH'], [-1600, '16TH'], [-1200, 'ROOSEVELT'], [-800, 'POLK'], [-600, 'HARRISON'], [-500, 'CONGRESS'],
  [-400, 'VAN BUREN'], [-300, 'JACKSON'], [-200, 'ADAMS'], [-100, 'MONROE'], [0, 'MADISON'],
  [100, 'WASHINGTON'], [150, 'RANDOLPH'], [200, 'LAKE'], [300, 'WACKER'], [400, 'KINZIE'],
  [430, 'HUBBARD'], [500, 'ILLINOIS'], [530, 'GRAND'], [600, 'OHIO'], [628, 'ONTARIO'],
  [660, 'ERIE'], [700, 'HURON'], [732, 'SUPERIOR'], [800, 'CHICAGO'], [860, 'CHESTNUT'],
  [900, 'DELAWARE'], [932, 'WALTON'], [1000, 'OAK'], [1200, 'DIVISION'], [1600, 'NORTH'],
  [2000, 'ARMITAGE'], [2400, 'FULLERTON'], [2800, 'DIVERSEY'], [3200, 'BELMONT'], [3600, 'ADDISON'],
]
const LAKE_EW = 700

export function worldToGrid(x, z) {
  return { ns: Math.round(-z / M_PER_NUMBER) || 0, ew: Math.round(x / M_PER_NUMBER) || 0 }
}

const nearest = (table, n) => table.reduce((best, row) => (Math.abs(row[0] - n) < Math.abs(best[0] - n) ? row : best))[1]

export function crossStreets(x, z, isWater) {
  const { ns, ew } = worldToGrid(x, z)
  if (isWater ? isWater(x, z) : ew > LAKE_EW) return 'LAKE MICHIGAN'
  return `${nearest(NS_STREETS, ew)} & ${nearest(EW_STREETS, ns)}`
}

// Typed addresses (P4 WORK): "233 S Wacker", "333 N Green St" → world metres. The parser knows more streets than the
// cross-street readout (whose table stays as it is): the West Loop and Fulton Market grid included.
const ADDRESS_NS = [...NS_STREETS, [-540, 'CLINTON'], [-650, 'DESPLAINES'], [-832, 'GREEN'], [-900, 'PEORIA'], [-932, 'SANGAMON'], [-1032, 'CARPENTER'],
  [-1100, 'ABERDEEN'], [-1132, 'MAY'], [-1232, 'ELIZABETH'], [-1300, 'ADA'], [-1400, 'NOBLE'], [-1500, 'GREENVIEW'], [-1700, 'PAULINA'], [-1800, 'WOOD'],
  [-600, 'LARRABEE'], [-400, 'ORLEANS'], [-75, 'RUSH'], [-50, 'STATE'], [130, 'ST CLAIR'], [-1000, 'HALSTED']].filter((r, i, a) => a.findIndex((q) => q[1] === r[1]) === i)
const SUFFIX = /\s+(st|street|ave|avenue|dr|drive|blvd|boulevard|rd|road|pl|place|pkwy|parkway|ct|court|way)\.?$/i
export function parseGridAddress(query) {
  const m = /^\s*(\d{1,5})\s+([nsew])\.?\s+(.+?)\s*$/i.exec(String(query ?? ''))
  if (!m) return null
  const n = Number(m[1]), dir = m[2].toUpperCase(), street = m[3].replace(SUFFIX, '').toUpperCase().replace(/\s+/g, ' ').trim()
  const find = (table) => table.find(([, name]) => name === street || name.startsWith(street) || street.startsWith(name))
  if (dir === 'N' || dir === 'S') { // a north–south street: its number is the east–west position
    const row = find(ADDRESS_NS)
    if (!row) return null
    return { x: row[0] * M_PER_NUMBER, z: (dir === 'S' ? n : -n) * M_PER_NUMBER, label: `${n} ${dir} ${row[1]}` }
  }
  const row = find(EW_STREETS)
  if (!row) return null
  return { x: (dir === 'E' ? n : -n) * M_PER_NUMBER, z: -row[0] * M_PER_NUMBER, label: `${n} ${dir} ${row[1]}` }
}
