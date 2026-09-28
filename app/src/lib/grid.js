// app/src/lib/grid.js — Chicago's address grid ↔ world metres.
// 800 address numbers = 1 mile. Origin: State (0 E/W) & Madison (0 N/S).
export const M_PER_NUMBER = 1609.344 / 800

// Signed address numbers: +E / -W for north-south streets, +N / -S for east-west streets.
const NS_STREETS = [ // streets that run north-south, keyed by E/W number
  [-1200, 'RACINE'], [-1000, 'MORGAN'], [-800, 'HALSTED'], [-600, 'JEFFERSON'], [-500, 'CANAL'],
  [-400, 'RIVERSIDE'], [-360, 'WACKER'], [-300, 'FRANKLIN'], [-200, 'WELLS'], [-140, 'LASALLE'],
  [-100, 'CLARK'], [-36, 'DEARBORN'], [0, 'STATE'], [45, 'WABASH'], [100, 'MICHIGAN'],
  [200, 'COLUMBUS'], [300, 'MCCLURG'], [400, 'LAKE SHORE'], [600, 'LAKE SHORE'],
]
const EW_STREETS = [ // streets that run east-west, keyed by N/S number
  [-1600, '16TH'], [-1200, 'ROOSEVELT'], [-800, 'POLK'], [-600, 'HARRISON'], [-500, 'CONGRESS'],
  [-400, 'VAN BUREN'], [-300, 'JACKSON'], [-200, 'ADAMS'], [-100, 'MONROE'], [0, 'MADISON'],
  [100, 'WASHINGTON'], [150, 'RANDOLPH'], [200, 'LAKE'], [300, 'WACKER'], [400, 'KINZIE'],
  [430, 'HUBBARD'], [500, 'ILLINOIS'], [530, 'GRAND'], [600, 'OHIO'], [628, 'ONTARIO'],
  [660, 'ERIE'], [700, 'HURON'], [732, 'SUPERIOR'], [800, 'CHICAGO'], [860, 'CHESTNUT'],
  [900, 'DELAWARE'], [932, 'WALTON'], [1000, 'OAK'], [1200, 'DIVISION'], [1600, 'NORTH'],
  [2000, 'ARMITAGE'], [2400, 'FULLERTON'],
]
const LAKE_EW = 700

export function worldToGrid(x, z) {
  return { ns: Math.round(-z / M_PER_NUMBER) || 0, ew: Math.round(x / M_PER_NUMBER) || 0 }
}

const nearest = (table, n) => table.reduce((best, row) => (Math.abs(row[0] - n) < Math.abs(best[0] - n) ? row : best))[1]

export function crossStreets(x, z) {
  const { ns, ew } = worldToGrid(x, z)
  if (ew > LAKE_EW) return 'LAKE MICHIGAN'
  return `${nearest(NS_STREETS, ew)} & ${nearest(EW_STREETS, ns)}`
}
