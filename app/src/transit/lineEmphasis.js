// app/src/transit/lineEmphasis.js — per-line glow emphasis (P4): WORK brightens the useful lines (gain 0–2), and
// CTA alerts make a line's glow breathe (pulse 0–1). The glow shader reads both through its line index.
import { MAX_LINES, glowUniforms } from './transitMaterials.js'

let index = new Map() // line id → glow index (each transit.json line carries its own)
export function setLineIndex(lines) { index = new Map((lines ?? []).map((l) => [l.id, l.index])) }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo))
export function setLineGain(id, gain) { const i = index.get(id); if (i != null && i < MAX_LINES) glowUniforms.uLineGain.value[i] = clamp(gain, 0, 2) }
export function setLinePulse(id, severity) { const i = index.get(id); if (i != null && i < MAX_LINES) glowUniforms.uLinePulse.value[i] = clamp(severity, 0, 1) }
export function resetLineEmphasis() { glowUniforms.uLineGain.value.fill(1); glowUniforms.uLinePulse.value.fill(0) }
export const lineEmphasisState = () => ({ gain: glowUniforms.uLineGain.value, pulse: glowUniforms.uLinePulse.value })
