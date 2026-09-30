// pipeline/lib/swapModel.js — take a Blender-refined model only when it fits the slot the procedural one fills
// (P3 Task 6): its length along X within `tolerance` of lengthM and its triangle count within [minTris, maxTris].
// Anchors (bogies, a seahorse's mouth) and impostors always stay the procedural model's, so nothing that depends
// on them moves.
export function swapModel(procedural, blender, { minTris, maxTris, tolerance = 0.02 }) {
  const keep = { ...procedural, source: 'procedural' }
  if (!blender?.positions?.length) return keep
  const tris = blender.positions.length / 9
  if (tris < minTris || tris > maxTris) return keep
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < blender.positions.length; i += 3) { lo = Math.min(lo, blender.positions[i]); hi = Math.max(hi, blender.positions[i]) }
  if (Math.abs(hi - lo - procedural.lengthM) > tolerance * procedural.lengthM) return keep
  return { ...procedural, mesh: blender, source: 'blender' }
}
