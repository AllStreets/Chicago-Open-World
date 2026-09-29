import { describe, it, expect } from 'vitest'
import { playerMat, floodlit } from '../Players.jsx'

describe('players under the floodlights', () => {
  it('the player material adds a floodlight term scaled by uFlood', () => {
    const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <emissivemap_fragment>\n}' }
    playerMat.onBeforeCompile(shader)
    expect(shader.uniforms.uFlood).toBe(floodlit)
    expect(shader.fragmentShader).toContain('uniform float uFlood;')
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += diffuseColor.rgb * uFlood;')
  })
})
