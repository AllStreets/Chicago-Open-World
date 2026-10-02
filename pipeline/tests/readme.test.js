// pipeline/tests/readme.test.js — the README gallery stays whole (X-4 / B-10): every local link and image
// resolves, every in-page anchor has its heading, no table has an empty cell or a short row, and every
// screenshot in docs/screenshots (and its evolution/ history) is shown somewhere in the README.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const README = readFileSync(join(ROOT, 'README.md'), 'utf8')

const links = () => {
  const out = []
  for (const m of README.matchAll(/\b(?:src|href)="([^"]+)"/g)) out.push(m[1])
  for (const m of README.matchAll(/\]\(([^)\s]+)\)/g)) out.push(m[1])
  return out
}
const isLocal = (u) => !/^(https?:|mailto:|#)/.test(u)

// GitHub's heading slug: lower case, drop punctuation (keep letters, digits, spaces, hyphens), spaces → hyphens
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-')

describe('README', () => {
  it('every local link and image resolves to a file in the repo', () => {
    const missing = links().filter(isLocal).map((u) => decodeURI(u.split('#')[0])).filter((p) => !existsSync(join(ROOT, p)))
    expect(missing).toEqual([])
  })

  it('every in-page anchor names a heading', () => {
    const anchors = new Set([...README.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])))
    const broken = links().filter((u) => u.startsWith('#')).map((u) => u.slice(1)).filter((a) => !anchors.has(a))
    expect(broken).toEqual([])
  })

  it('no table has an empty cell, and every row of a table is as wide as its others', () => {
    expect(README.match(/<td[^>]*>\s*<\/td>/g) ?? []).toEqual([])
    const ragged = []
    for (const [i, t] of [...README.matchAll(/<table>([\s\S]*?)<\/table>/g)].entries()) {
      const widths = [...t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
        [...r[1].matchAll(/<td([^>]*)>/g)].reduce((n, c) => n + Number(/colspan="(\d+)"/.exec(c[1])?.[1] ?? 1), 0))
      if (new Set(widths).size > 1) ragged.push(`table ${i + 1}: rows of ${widths.join(', ')}`)
    }
    expect(ragged).toEqual([])
  })

  it('every screenshot in docs/screenshots and its evolution history is shown in the README', () => {
    const shown = new Set(links().filter(isLocal))
    const orphans = []
    for (const dir of ['docs/screenshots', 'docs/screenshots/evolution']) {
      for (const f of readdirSync(join(ROOT, dir))) if (/\.(png|jpe?g|webp|gif)$/i.test(f) && !shown.has(`${dir}/${f}`)) orphans.push(`${dir}/${f}`)
    }
    expect(orphans).toEqual([])
  })
})
