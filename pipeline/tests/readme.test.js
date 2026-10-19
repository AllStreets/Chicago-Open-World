// pipeline/tests/readme.test.js — the README gallery stays whole (X-4 / B-10): every local link and image
// resolves, every in-page anchor has its heading, no table has an empty cell or a short row, and every
// screenshot in docs/screenshots (and its evolution/ history) is shown somewhere.
// 2026-10-19: the README became a short front page and the full illustrated tour moved to docs/TOUR.md, so
// every check runs on both files, links resolve from each file's own folder, and the screenshot coverage
// is the two together.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOCS = ['README.md', 'docs/TOUR.md'].map((rel) => ({ rel, dir: dirname(join(ROOT, rel)), text: readFileSync(join(ROOT, rel), 'utf8') }))

const links = (text) => {
  const out = []
  for (const m of text.matchAll(/\b(?:src|href)="([^"]+)"/g)) out.push(m[1])
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) out.push(m[1])
  return out
}
const isLocal = (u) => !/^(https?:|mailto:|#)/.test(u)
// a local link, as a path from the repo root
const fromRoot = (doc, u) => relative(ROOT, normalize(join(doc.dir, decodeURI(u.split('#')[0]))))

// GitHub's heading slug: lower case, drop punctuation (keep letters, digits, spaces, hyphens), spaces → hyphens
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-')

describe.each(DOCS)('$rel', (doc) => {
  it('every local link and image resolves to a file in the repo', () => {
    const missing = links(doc.text).filter(isLocal).map((u) => fromRoot(doc, u)).filter((p) => !existsSync(join(ROOT, p)))
    expect(missing).toEqual([])
  })

  it('every in-page anchor names a heading', () => {
    const anchors = new Set([...doc.text.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])))
    const broken = links(doc.text).filter((u) => u.startsWith('#')).map((u) => u.slice(1)).filter((a) => !anchors.has(a))
    expect(broken).toEqual([])
  })

  it('no table has an empty cell, and every row of a table is as wide as its others', () => {
    expect(doc.text.match(/<td[^>]*>\s*<\/td>/g) ?? []).toEqual([])
    const ragged = []
    for (const [i, t] of [...doc.text.matchAll(/<table>([\s\S]*?)<\/table>/g)].entries()) {
      const widths = [...t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
        [...r[1].matchAll(/<td([^>]*)>/g)].reduce((n, c) => n + Number(/colspan="(\d+)"/.exec(c[1])?.[1] ?? 1), 0))
      if (new Set(widths).size > 1) ragged.push(`table ${i + 1}: rows of ${widths.join(', ')}`)
    }
    expect(ragged).toEqual([])
  })
})

describe('README and tour together', () => {
  it('every screenshot in docs/screenshots and its evolution history is shown in one of them', () => {
    const shown = new Set(DOCS.flatMap((doc) => links(doc.text).filter(isLocal).map((u) => fromRoot(doc, u))))
    const orphans = []
    for (const dir of ['docs/screenshots', 'docs/screenshots/evolution']) {
      for (const f of readdirSync(join(ROOT, dir))) if (/\.(png|jpe?g|webp|gif)$/i.test(f) && !shown.has(`${dir}/${f}`)) orphans.push(`${dir}/${f}`)
    }
    expect(orphans).toEqual([])
  })
})
