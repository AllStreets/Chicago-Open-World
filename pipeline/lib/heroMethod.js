// pipeline/lib/heroMethod.js — which tool builds a hero's sculptural detail (I-3.4). The per-hero table is
// data/hero-methods.json; this is the rule it must agree with, in the order the plan gives:
// figurative → Blender; parametric → procedural; over the triangle limit → Blender; else procedural.
// Without Blender every row falls back to its procedural stand-in (the build never needs Blender).
export const METHOD_TRI_LIMIT = 40000

export function chooseMethod({ figurative, parametric, procTrisEstimate, blenderAvailable = true }) {
  if (!blenderAvailable) return 'procedural'
  if (figurative) return 'blender'
  if (parametric) return 'procedural'
  return procTrisEstimate > METHOD_TRI_LIMIT ? 'blender' : 'procedural'
}
