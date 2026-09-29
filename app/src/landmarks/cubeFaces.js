// app/src/landmarks/cubeFaces.js — Cloud Gate's mirror budget: a 128 px cube, one face per frame, refreshed every 30 frames.
export const CUBE = { size: 128, period: 30, near: 1, far: 3000, maxDist: 1500 }
export function cubeFaceFor(frame, period = CUBE.period) {
  const f = ((frame % period) + period) % period
  return f < 6 ? f : -1
}
export const cubeActive = ({ quality, camDist }) => quality !== 'LOW' && camDist <= CUBE.maxDist

// Render the given cube faces into rt with the scene's shadows frozen (a cube face must not re-run the city shadow
// pass), restore the renderer state, and flag the PMREM: MeshStandardMaterial turns a cube envMap into a PMREM once
// per pmremVersion, so without this the mirror keeps its very first image forever (V6 review #1).
export function renderCubeFaces(gl, rt, scene, cubeCam, faces) {
  if (!faces.length) return
  const prev = gl.getRenderTarget(), xr = gl.xr.enabled, shadows = gl.shadowMap.autoUpdate
  gl.xr.enabled = false; gl.shadowMap.autoUpdate = false
  for (const f of faces) { gl.setRenderTarget(rt, f); gl.render(scene, cubeCam.children[f]) }
  gl.setRenderTarget(prev); gl.xr.enabled = xr; gl.shadowMap.autoUpdate = shadows
  rt.texture.needsPMREMUpdate = true
}
