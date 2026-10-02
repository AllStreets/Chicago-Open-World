// app/src/lib/farDetail.js — camera-distance detail for what the target-centred tile plan keeps at full detail.
// The plan picks LOD0 tiles around the camera TARGET, so a high, far view (the wide poses) still draws full-detail
// tiles — every sculpted hero, parapet and lod0-only detail — from 4–5 km away, three times a frame (beauty, the
// water's mirror, the shadow map). A LOD0 tile that far from the CAMERA draws its own LOD1 buildings instead (sculpts
// as their LOD1 shape, plain footprints simplified, no parapets: < ⅓ px of difference at 3.5 km), still casting its
// shadow; trees, props, places, transit and ground stay the LOD0 tile's. Tree trunks drop out beyond ~1.5 km.
export const FAR_M = 3500 // a LOD0 tile's nearest point this far from the camera → its LOD1 buildings stand in
export const NEAR_M = 3300 // … and back to full detail inside this (hysteresis: no flicker at the edge)
export const TRUNK_M = 1500 // tree trunks (≈ 0.5 m wide, under the canopy) beyond this: < ½ px, not drawn
export const MIRROR_M = 2500 // 2 km blocks wholly beyond this stay out of the water's half-res mirror pass

// distance from a point to an axis-aligned box (x/z from tile bounds, y from `bottom` (the ground) to the tallest building)
export function boxDistance([x, y, z], { minX, maxX, minZ, maxZ }, top = 0, bottom = 0) {
  const dx = Math.max(minX - x, 0, x - maxX), dz = Math.max(minZ - z, 0, z - maxZ), dy = Math.max(bottom - y, 0, y - top)
  return Math.hypot(dx, dy, dz)
}

// is a LOD0 tile far enough from the camera for its stand-in? `was` is the last answer (hysteresis)
export const isFar = (camera, bounds, top, was = false) => boxDistance(camera, bounds, top) > (was ? NEAR_M : FAR_M)

// distance from a point to a sphere's surface (0 inside)
export const sphereDistance = ([x, y, z], { center, radius }) => Math.max(0, Math.hypot(x - center.x, y - center.y, z - center.z) - radius)

// any bascule leaf off its seat? (a far tile's LOD1 copy shows its leaves closed)
export const anyLeafLifted = (angles) => Object.values(angles ?? {}).some((a) => Math.abs(a) > 1e-4)
