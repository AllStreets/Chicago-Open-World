// app/src/world/materials/skyGain.js — the Sky shader is tuned for renderer tone mapping;
// with ACES in the composer its HDR output saturates to white, so scale it down.
const LINE = 'gl_FragColor = vec4( retColor, 1.0 );'

// cloud: [r, g, b, amount] — an overcast deck (the SNOW view) replaces the clear sky by `amount`
export function applySkyGain(material, gain, tint = null, cloud = null) {
  if (!material.uniforms.skyGain) {
    if (!material.fragmentShader.includes(LINE)) throw new Error('sky shader: output line not found')
    material.fragmentShader = 'uniform float skyGain;\nuniform vec3 skyTint;\nuniform vec4 skyCloud;\n' + material.fragmentShader.replace(LINE, 'gl_FragColor = vec4( mix( retColor * skyGain * skyTint, skyCloud.rgb, skyCloud.a ), 1.0 );')
    material.uniforms.skyGain = { value: gain }
    material.uniforms.skyTint = { value: [1, 1, 1] }
    material.uniforms.skyCloud = { value: [0, 0, 0, 0] }
    material.needsUpdate = true
  }
  material.uniforms.skyGain.value = gain
  if (tint) material.uniforms.skyTint.value = tint // user fixes: a clear day tints the sky toward blue
  if (cloud) material.uniforms.skyCloud.value = cloud
}
