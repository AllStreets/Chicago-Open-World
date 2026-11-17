import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { VARIANTS, VEHICLE_KINDS, VEHICLE_ROLES, variantOf, paintOf, paint2Of, mergeVehicleRoles, patchVehicleShader, vehicleUniforms } from '../vehicleModels.js'

describe('vehicle variants', () => {
  it('weights sum to 100 per sim type and every kind is reachable', () => {
    for (const list of Object.values(VARIANTS)) expect(list.reduce((s, v) => s + v.w, 0)).toBe(100)
    const seen = new Set()
    for (const type of Object.keys(VARIANTS)) for (let seed = 0; seed < 5000; seed += 3) seen.add(variantOf(type, seed).kind)
    expect([...seen].sort()).toEqual([...VEHICLE_KINDS].sort())
  })
  it('is deterministic per seed', () => {
    expect(variantOf('car', 123456)).toBe(variantOf('car', 123456))
  })
  it('taxis are yellow, buses white, paints shared (no allocation)', () => {
    expect(paintOf('taxi', 7).r).toBeGreaterThan(paintOf('taxi', 7).b * 4)
    expect(paintOf('bus', 3).getHexString()).toBe(paintOf('bus', 9).getHexString())
    expect(paint2Of(42)).toBe(paint2Of(42))
  })
})

describe('mergeVehicleRoles', () => {
  it('merges role-named meshes into one geometry with aRole and keeps unknown materials out', () => {
    const root = new THREE.Group()
    const add = (name, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name })); m.position.x = x; root.add(m) }
    add('paint', 0); add('glass.001', 2); add('mystery', 4)
    const g = mergeVehicleRoles(root)
    const roles = new Set(g.getAttribute('aRole').array)
    expect([...roles].sort()).toEqual([VEHICLE_ROLES.indexOf('paint'), VEHICLE_ROLES.indexOf('glass')].sort())
    expect(g.getAttribute('color')).toBeTruthy()
    g.computeBoundingBox()
    expect(g.boundingBox.max.x).toBeCloseTo(2.5) // the glass box moved to x = 2, the unknown one dropped
  })
})

describe('vehicle shader', () => {
  it('patches the standard shader chunks it needs', () => {
    const s = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} }
    patchVehicleShader(s, { ...vehicleUniforms(), uNight: { value: 0 } })
    expect(s.vertexShader).toContain('attribute vec3 aPaint;')
    expect(s.fragmentShader).toContain('roughnessFactor = uRoleRough[fr];')
    expect(s.uniforms.uRoleCol.value).toHaveLength(VEHICLE_ROLES.length)
  })
})
