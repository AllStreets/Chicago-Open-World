// shared/tileMeta.js — the tile sidecar (tiles/<key>.json) in its compact v2 form (X-0a), shared by the pipeline
// (encode) and the app (decode). v1 was an array of objects per building, mostly nulls; v2 is columnar:
//   s   one string table per tile (names, streets, hero/bridge keys, odd ids, place names)
//   b   buildings: id[] (a number n means `w${n}`), h[] height (m, 0.1 m as built), st[]/y[] stories/year (0 = none),
//       an[] house number (0 = none) + as[] street (table index + 1, 0 = no address), and sparse [i, s] pairs
//       for name, hero and bridge
//   t/p trees and roof props as flat rows of tw/pw numbers
//   q   places: columns of the v1 keys; n/a through the table, t (tags) sparse
// decodeTileMeta returns exactly the v1 objects (same keys, same order), and passes v1 through untouched.
export const TILE_META_VERSION = 2

const OSM_WAY = /^w([1-9]\d*)$/
const canonicalInt = (s) => /^(0|[1-9]\d*)$/.test(s) && Number.isSafeInteger(Number(s))

function table() {
  const list = [], at = new Map()
  const put = (s) => { if (!at.has(s)) { at.set(s, list.length); list.push(s) } return at.get(s) }
  return { list, put }
}

function splitAddress(a) {
  const m = /^(\d\S*) (.+)$/.exec(a)
  if (!m) return [0, a]
  const num = m[1]
  return [canonicalInt(num) && num !== '0' ? Number(num) : num, m[2]]
}

function flatRows(rows, what) {
  if (!rows?.length) return { w: 0, flat: [] }
  const w = rows[0].length
  if (rows.some((r) => r.length !== w)) throw new Error(`tileMeta: ${what} rows differ in length`)
  return { w, flat: rows.flat() }
}

export function encodeTileMeta({ buildings = [], trees = [], props = [], pois }) {
  const s = table()
  const b = { id: [], h: [], st: [], y: [], an: [], as: [], nm: [], hero: [], br: [] }
  buildings.forEach((r, i) => {
    const m = OSM_WAY.exec(r.id)
    b.id.push(m && Number.isSafeInteger(Number(m[1])) ? Number(m[1]) : r.id)
    b.h.push(r.height)
    for (const [k, col] of [['stories', b.st], ['year', b.y]]) {
      const v = r[k]
      if (v === 0 || (v != null && !Number.isFinite(v))) throw new Error(`tileMeta: ${k} ${v} of ${r.id} cannot be encoded`)
      col.push(v ?? 0)
    }
    if (r.address == null) { b.an.push(0); b.as.push(0) } else { const [num, street] = splitAddress(r.address); b.an.push(num); b.as.push(s.put(street) + 1) }
    if (r.name != null) b.nm.push(i, s.put(r.name))
    if (r.hero != null) b.hero.push(i, s.put(r.hero))
    if (r.bridge != null) b.br.push(i, s.put(r.bridge))
    const known = ['id', 'name', 'address', 'stories', 'year', 'height', 'hero', 'bridge']
    const extra = Object.keys(r).filter((k) => !known.includes(k))
    if (extra.length) throw new Error(`tileMeta: building ${r.id} has unknown keys ${extra.join(', ')}`)
  })
  const t = flatRows(trees, 'tree'), p = flatRows(props, 'prop')
  const out = { v: TILE_META_VERSION, s: s.list, b, tw: t.w, t: t.flat, pw: p.w, p: p.flat }
  if (pois) {
    const q = { id: [], n: [], c: [], x: [], y: [], z: [], b: [], a: [], t: [] }
    pois.forEach((r, i) => {
      const keys = Object.keys(r).join(',')
      if (!/^id,n,c,x,y,z,b(,a)?(,t)?$/.test(keys)) throw new Error(`tileMeta: place ${r.id} has keys ${keys}`)
      q.id.push(r.id); q.n.push(s.put(r.n)); q.c.push(r.c); q.x.push(r.x); q.y.push(r.y); q.z.push(r.z); q.b.push(r.b)
      q.a.push(r.a != null ? s.put(r.a) + 1 : 0)
      if (r.t) q.t.push(i, r.t)
    })
    out.q = q
  }
  return out
}

const rows = (flat, w) => { const out = []; for (let i = 0; i < flat.length; i += w) out.push(flat.slice(i, i + w)); return out }
const sparse = (pairs, s) => { const m = new Map(); for (let i = 0; i < pairs.length; i += 2) m.set(pairs[i], s ? s[pairs[i + 1]] : pairs[i + 1]); return m }

export function decodeTileMeta(json) {
  if (!json || json.v !== TILE_META_VERSION) return json
  const { s, b } = json
  const names = sparse(b.nm, s), heroes = sparse(b.hero, s), bridges = sparse(b.br, s)
  const buildings = b.id.map((id, i) => {
    const street = b.as[i] ? s[b.as[i] - 1] : null
    const rec = {
      id: typeof id === 'number' ? `w${id}` : id,
      name: names.get(i) ?? null,
      address: street == null ? null : b.an[i] === 0 ? street : `${b.an[i]} ${street}`,
      stories: b.st[i] || null,
      year: b.y[i] || null,
      height: b.h[i],
      hero: heroes.get(i) ?? null,
    }
    if (bridges.has(i)) rec.bridge = bridges.get(i)
    return rec
  })
  const out = { buildings, trees: json.tw ? rows(json.t, json.tw) : [], props: json.pw ? rows(json.p, json.pw) : [] }
  if (json.q) {
    const q = json.q, tags = sparse(q.t)
    out.pois = q.id.map((id, i) => {
      const r = { id, n: s[q.n[i]], c: q.c[i], x: q.x[i], y: q.y[i], z: q.z[i], b: q.b[i] }
      if (q.a[i]) r.a = s[q.a[i] - 1]
      if (tags.has(i)) r.t = tags.get(i)
      return r
    })
  }
  return out
}
