// app/src/lib/webgl.js — can this browser draw the city? The renderer needs WebGL2 (texture arrays, the facade
// shader). Checked once, before the Canvas mounts, so an old browser gets a picture and a sentence, not a blank page.
let cached = null
export function hasWebGL2() {
  if (cached !== null) return cached
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
export function resetWebGL2Check() { cached = null }
