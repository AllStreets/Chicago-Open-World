// pipeline/lib/styles.js — the style palette: one row per sourced look, indexed per vertex by _STYLE (spec B.6).
// Row 0 is "no style". The app builds a float DataTexture from styles.json; the PNG is a review swatch sheet.
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { FINISH_PRESETS, FINISHES, hexToRgb } from './looks.js'

export const STYLE_COLS = 7
export const MAX_STYLES = 256

export function styleEntry(key, look) {
  const p = FINISH_PRESETS[look.finish]
  const c = look.crownLight && look.crownLight.render !== false ? look.crownLight : null
  return {
    key, finish: look.finish, base: look.base, glass: look.glass, mullion: look.mullion, spandrel: look.spandrel,
    top: look.top ?? look.base, topFromM: look.top ? look.topFromM ?? 0 : 0, topM: look.top ? look.topM : 0,
    roughness: p.roughness, metalness: p.metalness,
    crown: c ? { kind: c.kind, color: c.color, fromM: c.fromM, toM: c.toM, intensity: c.intensity } : null,
  }
}

export function createStyleRegistry() {
  const rows = [{ key: 'none' }]
  const byKey = new Map([['none', 0]])
  return {
    add(key, look) {
      if (byKey.has(key)) return byKey.get(key)
      if (!look || look.render === false || rows.length >= MAX_STYLES) return 0
      rows.push(styleEntry(key, look))
      byKey.set(key, rows.length - 1)
      return rows.length - 1
    },
    indexOf: (key) => byKey.get(key) ?? 0,
    get size() { return rows.length },
    toJSON: () => ({ version: 1, cols: STYLE_COLS, styles: rows }),
  }
}

export function meshStyle(b, part) {
  if (!b?.styleIndex) return 0
  if (part === undefined) return b.styleIndex
  return (b.styleParts ?? []).includes(part) ? b.styleIndex : 0
}

export async function writeStylePalettePng(path, json, cell = 16) {
  const rows = json.styles, w = STYLE_COLS * cell, h = rows.length * cell
  const buf = Buffer.alloc(w * h * 4)
  rows.forEach((s, r) => {
    const grey = s.finish ? Math.round((255 * (FINISHES.indexOf(s.finish) + 1)) / FINISHES.length) : 0
    const cols = s.base ? [s.base, s.glass, s.mullion, s.spandrel, s.top, s.crown?.color ?? '#000000', null] : Array(STYLE_COLS).fill('#000000')
    cols.forEach((hex, c) => {
      const [R, G, B] = hex ? hexToRgb(hex) : [grey, grey, grey]
      for (let y = r * cell; y < (r + 1) * cell; y++) for (let x = c * cell; x < (c + 1) * cell; x++) {
        const i = (y * w + x) * 4
        buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = 255
      }
    })
  })
  mkdirSync(dirname(path), { recursive: true })
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path)
}

// Heroes are registered first and in heroes.json order, so their rows are stable across builds and never crowded out.
export function assignHeroStyles(buildings, heroes, registry) {
  for (const h of heroes) if (h.look) registry.add(h.key, h.look)
  const byKey = new Map(heroes.map((h) => [h.key, h]))
  for (const b of buildings) {
    if (!b.hero) continue
    b.styleIndex = registry.indexOf(b.hero)
    b.styleParts = byKey.get(b.hero)?.look?.parts ?? []
  }
}

// ── V6 material rows (pipeline/data/styles.json) ─────────────────────────────────────────────────────────
// Registered right after the hero looks and before the OSM looks, so their palette index is stable and the
// pipeline builders can ask for it by key (styleIndex) before build-world has assembled the registry.
const STYLES_JSON = new URL('../data/styles.json', import.meta.url)
const LP_STYLES_JSON = new URL('../data/styles-lincolnpark.json', import.meta.url) // the Lincoln Park pass (B), appended
const HEROES_JSON = new URL('../data/heroes.json', import.meta.url)
export const materialRows = () => [...JSON.parse(readFileSync(STYLES_JSON, 'utf8')).styles, ...JSON.parse(readFileSync(LP_STYLES_JSON, 'utf8')).styles]
// a row may give its own glass/mullion/spandrel colours and a floodlight band (the night light of the building it dresses)
export const materialLook = (r) => ({ finish: r.finish, base: r.base, glass: r.glass ?? r.base, mullion: r.mullion ?? r.base, spandrel: r.spandrel ?? r.base, ...(r.crownLight ? { crownLight: r.crownLight } : {}) })
export function addMaterialStyles(registry, rows = materialRows()) { for (const r of rows) registry.add(r.key, materialLook(r)) }

let defaultRegistry = null
export function styleIndex(key) {
  if (!defaultRegistry) {
    defaultRegistry = createStyleRegistry()
    for (const h of JSON.parse(readFileSync(HEROES_JSON, 'utf8')).heroes) if (h.look) defaultRegistry.add(h.key, h.look)
    addMaterialStyles(defaultRegistry)
  }
  const i = defaultRegistry.indexOf(key)
  if (!i) throw new Error(`styleIndex: unknown style ${key}`)
  return i
}

// A landmark mesh that names its own material (V6: 'georgia-pink-marble', 'seahorse-bronze', …) uses that row;
// otherwise the hero's part styling decides, as for V2 venue parts.
export const partStyle = (b, v) => (v.style ? styleIndex(v.style) : meshStyle(b, v.part))
