// app/src/world/materials/skyGain.js — the Sky shader is tuned for renderer tone mapping;
// with ACES in the composer its HDR output saturates to white, so scale it down.
const LINE = 'gl_FragColor = vec4( retColor, 1.0 );'

export function applySkyGain(material, gain) {
  if (!material.uniforms.skyGain) {
    if (!material.fragmentShader.includes(LINE)) throw new Error('sky shader: output line not found')
    material.fragmentShader = 'uniform float skyGain;\n' + material.fragmentShader.replace(LINE, 'gl_FragColor = vec4( retColor * skyGain, 1.0 );')
    material.uniforms.skyGain = { value: gain }
    material.needsUpdate = true
  }
  material.uniforms.skyGain.value = gain
}
