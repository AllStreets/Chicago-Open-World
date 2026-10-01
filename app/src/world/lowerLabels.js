// app/src/world/lowerLabels.js — D4-2: the names of Chicago's lower streets ("Lower Wacker Dr") and of the
// Riverwalk's rooms ("Marina Plaza"), as WorldLabels items. Pure: LowerLabels.jsx decides when they show (the street
// names only with U on; the rooms with U on, or when the camera is down by the river).

const DIR = /^(North|South|East|West)\s+(?!Water\b)/
const ABBR = [[/\bDrive\b/g, 'Dr'], [/\bAvenue\b/g, 'Ave'], [/\bStreet\b/g, 'St'], [/\bBoulevard\b/g, 'Blvd'], [/\bCourt\b/g, 'Ct'], [/\bPlace\b/g, 'Pl'], [/\bSaint\b/g, 'St']]
const SKIP = /Garage|Busway|Access|Lake Front/
const MAJOR = /^Lower (Wacker|Michigan|Columbus|Randolph|Lake Shore|Lower Wacker|Lower Randolph)\b/

// an OSM lower way's name and level → the name people say ("East Lower Wacker Drive" → "Lower Wacker Dr", level 2's
// "East Wacker Service Drive" → "Lower Lower Wacker Service Dr"); null for the unnamed and the garage ramps
export function lowerStreetName(name, lv) {
  if (!name || SKIP.test(name)) return null
  let base = name.replace(/Jean Baptiste Point DuSable /g, '').replace(/\bLower\s+/g, '').replace(DIR, '')
  for (const [re, s] of ABBR) base = base.replace(re, s)
  if (lv === 2 && /^Wacker Service Dr$/.test(base.trim())) return 'Lower Lower Wacker Dr' // the famous third level
  return `${lv === 2 ? 'Lower Lower' : 'Lower'} ${base.trim()}`
}

const lengthOf = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L }
function midpoint(p) {
  const half = lengthOf(p) / 2
  let s = 0
  for (let i = 1; i < p.length; i++) {
    const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
    if (s + d >= half) { const t = (half - s) / (d || 1); return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, p[i - 1][2] + (p[i][2] - p[i - 1][2]) * t] }
    s += d
  }
  return p[0]
}

export const LOWER_COLOR = '#ffb547' // the sodium of the strip lights down there
export const ROOM_COLOR = '#3fd0c9' // the river
export const LABELS = { minPieceM: 45, gapM: 380, perName: 4, liftM: 2.2, fadeNear: 900, fadeFar: 2600, minorNear: 520, minorFar: 640 } // side streets come in sharply once close: never a half-read ghost

// lower-levels.json → [{ id, x, y, z, text, sub, kind: 'lower', priority, at }]: one label per lower street at the middle
// of its longest stretch on its level, and again along it every `gapM` (Lower Wacker runs 2 km), level pieces only
export function lowerStreetLabels(json, opts = {}) {
  const o = { ...LABELS, ...opts }, byName = new Map()
  for (const w of json?.ways ?? []) {
    const text = lowerStreetName(w.n, w.lv), levelY = json.y?.[w.lv]
    if (!text || levelY == null) continue
    const flat = w.p.filter((q) => Math.abs(q[2] - levelY) < 0.1)
    if (flat.length < 2 || lengthOf(flat) < o.minPieceM) continue
    if (!byName.has(text)) byName.set(text, [])
    byName.get(text).push({ w, flat, len: lengthOf(flat) })
  }
  const out = []
  for (const [text, pieces] of [...byName].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    pieces.sort((a, b) => b.len - a.len || a.w.id - b.w.id)
    const placed = []
    for (const pc of pieces) {
      if (placed.length >= o.perName) break
      const m = midpoint(pc.flat)
      if (placed.some((q) => Math.hypot(q[0] - m[0], q[1] - m[1]) < o.gapM)) continue
      placed.push(m)
    }
    const lv = pieces[0].w.lv
    placed.forEach((m, k) => out.push({
      id: `lower:${text}:${k}`, x: m[0], y: m[2] + o.liftM, z: m[1], text, sub: lv === 2 ? 'third level' : 'lower level', kind: 'lower', color: LOWER_COLOR,
      // the famous ones from across the Loop; the side streets only once you are close
      priority: MAJOR.test(text) ? 3 : 1.5, fadeNear: MAJOR.test(text) ? o.fadeNear : o.minorNear, fadeFar: MAJOR.test(text) ? o.fadeFar : o.minorFar, keepInside: true, at: [m[0], m[2], m[1]],
    }))
  }
  return out
}

const short = (s) => { let t = s ?? ''; for (const [re, r] of ABBR) t = t.replace(re, r); return t.replace(/\s*\(.*\)$/, '') }

// the Riverwalk's rooms (pipeline/data/riverwalk.json) between their bridges (bridges.json), placed on the Riverwalk's
// floor (river-levels.json floors): [{ id, x, y, z, text, sub, kind: 'room', priority, at }]
export function riverwalkRoomLabels(rooms, bridges, floors, riverwalkY, opts = {}) {
  const o = { liftM: 3, fadeNear: 700, fadeFar: 2200, ...opts }
  const byKey = new Map((bridges ?? []).map((b) => [b.key, b]))
  // the floor's outline, every ≤ 4 m (a room's middle is the middle of the outline between its bridges)
  const dense = (ring) => ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4))
    return Array.from({ length: n }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  })
  const pts = (floors ?? []).filter((f) => f.y == null || Math.abs(f.y - riverwalkY) < 0.3).flatMap((f) => dense(f.outer ?? []))
  if (!pts.length || !Number.isFinite(riverwalkY)) return []
  const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]))
  const out = []
  for (const r of rooms ?? []) {
    const e = r.east ? byKey.get(r.east) : null, w = r.west ? byKey.get(r.west) : null
    if ((r.east && !e) || (r.west && !w)) continue
    const x0 = w ? w.centre[0] : minX, x1 = e ? e.centre[0] : maxX
    const pad = Math.min(8, (x1 - x0) / 4)
    const inRoom = pts.filter((q) => q[0] > x0 + pad && q[0] < x1 - pad)
    if (!inRoom.length) continue
    const x = inRoom.reduce((a, q) => a + q[0], 0) / inRoom.length, z = inRoom.reduce((a, q) => a + q[1], 0) / inRoom.length
    out.push({
      id: `room:${r.key}`, x, y: riverwalkY + o.liftM, z, text: r.name, sub: `Riverwalk · ${short(r.street).replace(/ \(.*$/, '')}`, kind: 'room', color: ROOM_COLOR,
      priority: 2, fadeNear: o.fadeNear, fadeFar: o.fadeFar, keepInside: true, at: [x, riverwalkY, z],
    })
  }
  return out
}

// a flight that sets a label's place in the middle of the view, a little above and to the south of it
export const labelPose = ({ at }, up = 70, back = 90) => ({ position: [at[0], up, at[2] + back], target: [at[0], at[1], at[2]] })
