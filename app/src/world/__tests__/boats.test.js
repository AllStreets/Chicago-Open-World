// B-8: the harbours' boats — decode, level of detail, role-merged geometry and the recolouring shader.
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { decodeBoats, assignLods, mergeRoles, patchBoatShader, createBoatMaterial, ROLES, LOD0_M, LOD1_M, STRIDE } from '../boats.js'

const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} })

describe('boats (B-8)', () => {
  it('decodes seven numbers per boat; a malformed file is no boats', () => {
    expect(decodeBoats({ boats: [1, 2, 0.5, 1.1, 0, 3, 4] })).toEqual([{ x: 1, z: 2, yaw: 0.5, scale: 1.1, kind: 0, hull: 3, trim: 4 }])
    expect(decodeBoats({ boats: [1, 2] })).toEqual([])
    expect(decodeBoats(null)).toEqual([])
    expect(STRIDE).toBe(7)
  })
  it('the full model only near the camera, the light one to LOD1_M, nothing beyond', () => {
    const boats = [{ x: 10, z: 0 }, { x: LOD0_M + 50, z: 0 }, { x: LOD1_M + 50, z: 0 }]
    expect(assignLods(boats, [0, 5, 0])).toEqual({ lod0: [0], lod1: [1] })
    expect(assignLods(boats, [0, LOD1_M, 0])).toEqual({ lod0: [], lod1: [] }) // height counts too
    expect(assignLods(boats, [0, 5, 0], { inView: (x) => x > 100 })).toEqual({ lod0: [], lod1: [1] }) // out of view: not drawn
  })
  it('merges the role-named materials into one geometry with a role per vertex and the baked AO', () => {
    const g = new THREE.Group()
    for (const r of ['hull', 'mast', 'unknown']) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: r })); g.add(m) }
    const geo = mergeRoles(g)
    expect(geo.attributes.position.count).toBe(72) // two boxes, 36 vertices each (the unknown role is dropped)
    expect(new Set(geo.attributes.aRole.array)).toEqual(new Set([ROLES.indexOf('hull'), ROLES.indexOf('mast')]))
    expect(geo.attributes.color.itemSize).toBe(3)
  })
  it('the shader drops the rig on power boats and the hardtop on sailboats, recolours hull and trim, lights the masthead at night', () => {
    const s = patchBoatShader(std(), { uNight: { value: 0 } })
    expect(s.vertexShader).toMatch(/aKind > 0\.5\) \|\| \(\(r == 9 \|\| r == 10\) && aKind < 0\.5\)\) transformed = vec3\(0\.0\)/)
    expect(s.vertexShader).toContain('rc = aHull')
    expect(s.fragmentShader).toContain('diffuseColor.rgb *= vRoleCol')
    expect(s.fragmentShader).toContain('vGlow')
    expect(createBoatMaterial({}).customProgramCacheKey()).toBe('boat-v1')
  })
})
