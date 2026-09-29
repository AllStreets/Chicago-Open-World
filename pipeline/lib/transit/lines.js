// pipeline/lib/transit/lines.js — which CTA / Metra line an OSM route relation is, from the sourced catalog.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'transit-lines.json')
export const loadCatalog = (path = DATA) => JSON.parse(readFileSync(path, 'utf8'))
export const lineOrder = (catalog) => catalog.lines.map((l) => l.id)

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')

export function operatorOf(tags = {}) {
  const s = `${tags.network ?? ''};${tags.operator ?? ''}`
  if (/\bcta\b|chicago transit authority/i.test(s)) return 'cta'
  if (/\bmetra\b|northeast illinois regional commuter/i.test(s)) return 'metra'
  return null
}

export function lineIdFor(tags = {}, catalog) {
  const op = operatorOf(tags)
  if (!op) return null
  const lines = catalog.lines.filter((l) => l.operator === op)
  const ref = norm(tags.ref)
  if (ref) {
    const hit = lines.find((l) => l.refs.includes(ref))
    if (hit) return hit.id
  }
  // longest alias first, so "union pacific northwest" wins over "union pacific north"
  const name = String(tags.name ?? '').toLowerCase()
  const aliases = lines.flatMap((l) => l.names.map((n) => [n, l.id])).sort((a, b) => b[0].length - a[0].length)
  return aliases.find(([n]) => name.includes(n))?.[1] ?? null
}
