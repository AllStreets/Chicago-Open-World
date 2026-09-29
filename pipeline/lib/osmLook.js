// pipeline/lib/osmLook.js — OpenStreetMap building:colour / building:material → a look for non-landmark buildings (F11).
import { hexToRgb } from './looks.js'

// OSM colour words describe a hue family, not a CSS primary: map them to muted architectural equivalents.
export const NAMED_COLOURS = {
  white: '#f2f0ea', black: '#1e1e1e', grey: '#8c8c8a', gray: '#8c8c8a', lightgrey: '#bdbdba', lightgray: '#bdbdba',
  darkgrey: '#555553', darkgray: '#555553', silver: '#b8bcc0', red: '#8a3b30', darkred: '#6b2a24', maroon: '#6b2a24',
  brown: '#6e4a36', tan: '#c2a883', beige: '#d8ccb0', cream: '#e8dfc8', yellow: '#d9c27a', orange: '#b8683c',
  pink: '#d4a59a', blue: '#5e7a95', lightblue: '#8fa9bf', green: '#5d7a5e', darkgreen: '#34503a',
}
export const MATERIAL_FINISH = {
  glass: 'glass', metal: 'metal', steel: 'metal', aluminium: 'metal', aluminum: 'metal', copper: 'metal',
  concrete: 'concrete', plaster: 'concrete', cement_block: 'concrete', stucco: 'concrete',
  brick: 'terracotta', terracotta: 'terracotta', clay: 'terracotta',
  stone: 'limestone', limestone: 'limestone', sandstone: 'limestone',
  granite: 'granite', marble: 'granite',
}
const DEFAULT_BASE = { glass: '#6f8394', metal: '#9aa0a5', concrete: '#bdb9b1', terracotta: '#8a4b3a', limestone: '#cdc3ad', granite: '#9c9a96' }
const SOURCE = ['https://wiki.openstreetmap.org/wiki/Key:building:colour', 'https://wiki.openstreetmap.org/wiki/Key:building:material']

export function parseOsmColour(v) {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase().replace(/[\s_-]/g, '')
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join('')}`
  return NAMED_COLOURS[s] ?? null
}

export const quantizeHex = (hex) => `#${hexToRgb(hex).map((c) => (Math.round(c / 17) * 17).toString(16).padStart(2, '0')).join('')}`

export function lookFromOsmTags(tags) {
  if (!tags) return null
  const matTag = String(tags['building:material'] ?? '').trim().toLowerCase()
  const finish = MATERIAL_FINISH[matTag] ?? null
  const colour = parseOsmColour(tags['building:colour'])
  if (!finish && !colour) return null
  const f = finish ?? 'concrete'
  const base = quantizeHex(colour ?? DEFAULT_BASE[f])
  return {
    material: `OSM building:colour=${tags['building:colour'] ?? '-'} building:material=${tags['building:material'] ?? '-'}`,
    finish: f, base, glass: f === 'glass' ? base : '#3a4046', mullion: base, spandrel: base, source: SOURCE,
  }
}

export const osmStyleKey = (look) => `osm:${look.finish}:${look.base}`

export function applyOsmLooks(buildings, registry, { enabled }) {
  let styled = 0, skipped = 0
  if (!enabled) return { styled, skipped }
  for (const b of buildings) {
    if (b.hero || b.facadeOverride) continue
    const look = lookFromOsmTags(b.tags)
    if (!look) continue
    const idx = registry.add(osmStyleKey(look), look)
    if (idx === 0) { skipped++; continue }
    b.styleIndex = idx; b.styleParts = []; styled++
  }
  return { styled, skipped }
}
