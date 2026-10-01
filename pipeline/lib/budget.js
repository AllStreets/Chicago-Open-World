// pipeline/lib/budget.js — the world-size ledger (X-0e). Every build prints MB per top-level folder and root file (tiles
// split by kind), the delta against the previous build's ledger, and fails above the 197 MB content cap — a 3 MB
// margin under the 200 MB hard cap (B.1.6). Raising the hard cap is a separate, reported decision (plan §6.1).
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const BUDGET = { contentMB: 197, hardMB: 200 }
// outputs of earlier formats and phases that no current build writes and nothing in the app loads
export const STALE_OUTPUTS = ['minimap.png', 'trees.json', 'props.json', 'columns.json']

const dirBytes = (d) => readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirBytes(join(d, e.name)) : statSync(join(d, e.name)).size), 0)
const kindOf = (f) => (f.endsWith('.lod1.glb') ? 'lod1.glb' : f.slice(f.indexOf('.') + 1))

export function worldLedger(dir) {
  const entries = {}
  let total = 0
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name), n = e.isDirectory() ? dirBytes(p) : statSync(p).size
    entries[e.name] = n
    total += n
    if (e.name === 'tiles' || e.name === 'blocks') for (const f of readdirSync(p)) { const k = `${e.name}:${kindOf(f)}`; entries[k] = (entries[k] ?? 0) + statSync(join(p, f)).size }
  }
  return { total, entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) }
}

const mb = (n) => `${(n / 1e6).toFixed(2)} MB`
const signed = (n) => `${n >= 0 ? '+' : '-'}${Math.abs(n / 1e6).toFixed(2)}`

export function ledgerReport(cur, prev = null) {
  const keys = [...new Set([...Object.keys(cur.entries), ...Object.keys(prev?.entries ?? {})])].sort()
  const w = Math.max(5, ...keys.map((k) => k.length))
  const row = (k, a, b) => `${k.padEnd(w)}  ${mb(a).padStart(10)}${prev ? `  ${signed(a - b).padStart(7)}` : ''}`
  return [...keys.map((k) => row(k, cur.entries[k] ?? 0, prev?.entries?.[k] ?? 0)), row('total', cur.total, prev?.total ?? 0)]
}

export function checkBudget(total, { contentMB = BUDGET.contentMB } = {}) {
  if (total > BUDGET.hardMB * 1e6) throw new Error(`public/world is ${mb(total)} — over the ${BUDGET.hardMB} MB hard cap (B.1.6)`)
  if (total > contentMB * 1e6) throw new Error(`public/world is ${mb(total)} — over the ${contentMB} MB content cap (X-0e; ${BUDGET.hardMB} MB hard cap)`)
}

export function sweepStale(dir) {
  const gone = STALE_OUTPUTS.filter((f) => existsSync(join(dir, f)))
  for (const f of gone) rmSync(join(dir, f))
  return gone
}
