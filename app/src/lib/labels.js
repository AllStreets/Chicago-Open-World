// app/src/lib/labels.js — one label layout for every world label (P4): beacons, place pins and neighbourhood names.
// Distance fades each item (1 near, 0 far); labels are placed greedily by priority, then nearness, and any label
// that would overlap one already placed is dropped, so a crowded view stays readable.
export function beaconLayout(items, { toScreen, width, height, maxLabels = 16, fadeNear = 2000, fadeFar = 6000, box = { w: 140, h: 22 } }) {
  const placed = [], out = []
  const scored = items.map((it) => {
    const s = toScreen(it.x, it.y, it.z) ?? {}
    const on = s.visible !== false && Number.isFinite(s.sx) && s.sx >= 0 && s.sx <= width && s.sy >= 0 && s.sy <= height
    const alpha = on ? Math.max(0, Math.min(1, (fadeFar - s.depth) / (fadeFar - fadeNear))) : 0
    return { it, s, on, alpha }
  })
  const order = scored.filter((r) => r.on && r.alpha > 0).sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.s.depth - b.s.depth)
  const labelled = new Set()
  for (const r of order) {
    if (placed.length >= maxLabels) break
    const b = { x0: r.s.sx - box.w / 2, x1: r.s.sx + box.w / 2, y0: r.s.sy - box.h, y1: r.s.sy }
    if (placed.some((p) => b.x0 < p.x1 && p.x0 < b.x1 && b.y0 < p.y1 && p.y0 < b.y1)) continue
    placed.push(b); labelled.add(r.it.id)
  }
  for (const r of scored) out.push({ id: r.it.id, sx: r.s.sx, sy: r.s.sy, alpha: r.alpha, labelled: labelled.has(r.it.id) })
  return out
}
