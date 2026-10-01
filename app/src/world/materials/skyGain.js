// app/src/world/materials/skyGain.js — the Sky shader is tuned for renderer tone mapping;
// with ACES in the composer its HDR output saturates to white, so scale it down.
const LINE = 'gl_FragColor = vec4( retColor, 1.0 );'
// the solar disc: ~19000× the sky's radiance, so even a 92% cloud deck let it burn through (user, 2026-09-30)
const DISC = 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk;'

// cloud: [r, g, b, amount] — an overcast deck (the SNOW view) replaces the clear sky by `amount`
// sunDisc: 0..1 — how much of the solar disc shows (1 − the weather's veil: rain, fog, snow, overcast)
export function applySkyGain(material, gain, tint = null, cloud = null, sunDisc = null) {
  if (!material.uniforms.skyGain) {
    if (!material.fragmentShader.includes(LINE)) throw new Error('sky shader: output line not found')
    material.fragmentShader = 'uniform float skyGain;\nuniform vec3 skyTint;\nuniform vec4 skyCloud;\nuniform float skySunDisc;\n' + material.fragmentShader
      .replace(DISC, 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk * skySunDisc;')
      .replace(LINE, 'gl_FragColor = vec4( mix( retColor * skyGain * skyTint, skyCloud.rgb, skyCloud.a ), 1.0 );')
    material.uniforms.skyGain = { value: gain }
    material.uniforms.skyTint = { value: [1, 1, 1] }
    material.uniforms.skyCloud = { value: [0, 0, 0, 0] }
    material.uniforms.skySunDisc = { value: 1 }
    material.needsUpdate = true
  }
  material.uniforms.skyGain.value = gain
  if (tint) material.uniforms.skyTint.value = tint // user fixes: a clear day tints the sky toward blue
  if (cloud) material.uniforms.skyCloud.value = cloud
  if (sunDisc !== null && sunDisc !== undefined) material.uniforms.skySunDisc.value = sunDisc
}
