// pipeline/lib/classify.js — pick one of 8 façade families per building.
export const FACADE_FAMILIES = [
  'loop-limestone', 'art-deco', 'prewar-brick', 'curtain-glass',
  'precast-concrete', 'river-north-loft', 'three-flat-brick', 'industrial',
]

// Phase 1 flat colors (Phase 2 replaces with texture atlas layers).
export const FACADE_COLORS = [
  [0.74, 0.69, 0.60], // loop-limestone
  [0.66, 0.60, 0.51], // art-deco
  [0.55, 0.36, 0.28], // prewar-brick
  [0.36, 0.45, 0.53], // curtain-glass
  [0.62, 0.61, 0.58], // precast-concrete
  [0.50, 0.31, 0.24], // river-north-loft
  [0.56, 0.38, 0.29], // three-flat-brick
  [0.44, 0.42, 0.39], // industrial
]

const F = Object.fromEntries(FACADE_FAMILIES.map((n, i) => [n, i]))

const HOUSE = new Set(['house', 'detached', 'semidetached_house', 'terrace'])
const INDUSTRIAL = new Set(['industrial', 'warehouse', 'manufacture', 'factory'])

export function classifyFacade({ height, year, area, type }) {
  const known = year > 1800
  if (type) {
    if (HOUSE.has(type)) return F['three-flat-brick']
    if (INDUSTRIAL.has(type)) return F['industrial']
    if (type === 'church' || type === 'cathedral') return F['loop-limestone']
    if ((type === 'apartments' || type === 'residential') && height < 20) return known && year < 1940 ? F['prewar-brick'] : F['three-flat-brick']
  }
  if (height >= 60 && (!known || year >= 1960)) return F['curtain-glass']
  if (height >= 40 && known && year >= 1925 && year < 1960) return F['art-deco']
  if (height >= 40 && known && year < 1925) return F['loop-limestone']
  if (height < 20 && area >= 4000) return F['industrial']
  if (height < 15 && area < 600) return F['three-flat-brick']
  if (known && year >= 1880 && year <= 1930) return F['river-north-loft']
  if (known && year < 1960) return F['prewar-brick']
  return F['precast-concrete']
}
