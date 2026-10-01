// app/src/lib/hints.js — which key hints fit the bottom bar between the left stack and the dock/minimap column.
import { FEATURE_CONTROLS } from '../hud/featureControls.js'

const BASE = [
  { k: '↑↓←→', label: 'move', p: 1 }, { k: 'Shift+arrows', label: 'turn', p: 3 }, { k: 'R / F', label: 'up / down', p: 3 },
  { k: 'Double-click', label: 'fly there', p: 1 }, { k: '⌘K', label: 'search', p: 1 },
]
const TAIL = [{ k: '[ ]', label: 'views', p: 2 }, { k: '?', label: 'help', p: 1 }]
export const ALL_HINTS = [...BASE, ...FEATURE_CONTROLS.map((c) => ({ k: c.keyLabel, label: c.hint, p: c.hintP ?? 2 })), ...TAIL]

// px at design scale: kbd chip (padding + ~7.5 px per glyph), gap, label (~6.2 px per char), item gap
export const hintWidth = ({ k, label }) => 14 + k.length * 7.5 + 6 + label.length * 6.2 + 16
const SIDE = 196 + 16 + 16 // dock/minimap column (and the same margin on the left)
export const hintMaxWidth = (layoutW) => layoutW - 2 * SIDE

export function fitHints(hints, maxW) {
  const order = hints.map((h, i) => i).sort((a, b) => hints[a].p - hints[b].p || a - b)
  const keep = new Set()
  let w = 32 // bar padding
  for (const i of order) {
    const hw = hintWidth(hints[i])
    if (w + hw > maxW) continue
    keep.add(i); w += hw
  }
  return hints.filter((_, i) => keep.has(i))
}
