// F-9: the boat fleet — role parts from a model, LOD by distance, livery tints per instance, few draw calls.
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { splitBoatModel, boatMaterials, ROLE_RGB } from '../boatModels.js'
import { buildFleet, lodFor } from '../fleet.js'

// a fake glTF scene: lod0 / lod1 groups of meshes, one per role material, with an occlusion colour
function fakeModel() {
  const scene = new THREE.Group()
  for (const [lod, roles] of [['lod0', ['hull', 'trim', 'canopy', 'glass', 'deck', 'seat']], ['lod1', ['hull', 'trim', 'glass', 'deck']]]) {
    const g = new THREE.Group(); g.name = lod
    for (const role of roles) {
      const geo = new THREE.BoxGeometry(1, 1, 1)
      geo.deleteAttribute('uv')
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geo.getAttribute('position').count * 4).fill(0.5), 4))
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: role }))
      g.add(m)
    }
    scene.add(g)
  }
  return scene
}

describe('splitBoatModel', () => {
  it('keeps the livery roles and glass apart and merges the rest, occlusion × role colour', () => {
    const s = splitBoatModel(fakeModel())
    expect(Object.keys(s.lod0.parts).sort()).toEqual(['canopy', 'fixed', 'glass', 'hull', 'trim'])
    expect(Object.keys(s.lod1.parts).sort()).toEqual(['fixed', 'glass', 'hull', 'trim'])
    expect(s.lod0.tris).toBe(6 * 12)
    const hull = s.lod0.parts.hull.getAttribute('color')
    expect(hull.getX(0)).toBeCloseTo(0.5, 5) // white × 0.5 occlusion
    const fixed = s.lod0.parts.fixed.getAttribute('color'), deck = new THREE.Color(ROLE_RGB.deck)
    expect(fixed.getX(0)).toBeCloseTo(0.5 * deck.r, 5)
  })
})

describe('a quantised export (meshopt: int16 positions, the metres in the node transform)', () => {
  it('reads the attribute before placing it, so nothing clamps to ±1', () => {
    const scene = new THREE.Group(), lod0 = new THREE.Group()
    lod0.name = 'lod0'
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Int16Array([-32767, 0, 0, 32767, 0, 0, 0, 32767, 0]), 3, true))
    geo.setIndex([0, 1, 2])
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'hull' }))
    m.scale.set(14, 2, 2) // the dequantisation scale
    lod0.add(m); scene.add(lod0)
    const g = splitBoatModel(scene).lod0.parts.hull
    g.computeBoundingBox()
    expect(g.boundingBox.max.x).toBeCloseTo(14, 2)
    expect(g.boundingBox.min.x).toBeCloseTo(-14, 2)
    expect(g.boundingBox.max.y).toBeCloseTo(2, 2)
  })
})

describe('the fleet', () => {
  const kinds = { tourboat: { ...splitBoatModel(fakeModel()), liveries: [{ hull: '#ff0000', trim: '#00ff00', canopy: '#0000ff' }] } }
  const boats = [{ k: 'tourboat', x: 0, y: -6.3, z: 0, h: 0, l: 0 }, { k: 'tourboat', x: 500, y: -6.3, z: 0, h: 1, l: 0 }, { k: 'tourboat', x: 5000, y: -6.3, z: 0, h: 2, l: 0 }]
  it('draws LOD0 near, LOD1 far, nothing beyond', () => {
    expect(lodFor(boats, [0, 0, 0], { lod1At: 220, farAt: 2600 })).toEqual([0, 1, -1])
    const f = buildFleet(kinds, boats, boatMaterials(), { lod1At: 220, farAt: 2600 })
    expect(f.update([0, 0, 0])).toBe(true)
    expect(f.update([0, 0, 0])).toBe(false) // nothing changed: no buffer writes
    expect(f.counts()).toMatchObject({ lod0: 1, lod1: 1 })
    expect(f.counts().tris).toBe(6 * 12 + 4 * 12)
    // five draw calls a kind and LOD at most, whatever the count
    expect(f.group.children.filter((m) => m.name.includes(':lod0:')).length).toBe(5)
    const hull0 = f.group.getObjectByName('boats:tourboat:lod0:hull'), c = new THREE.Color()
    hull0.getColorAt(0, c)
    expect(c.r).toBeGreaterThan(0.9); expect(c.g).toBeLessThan(0.05)
    expect(f.group.getObjectByName('boats:tourboat:lod0:fixed').instanceColor).toBeNull()
    f.update([5000, 0, 0])
    expect(f.counts()).toMatchObject({ lod0: 1, lod1: 0 }) // the far boat is near now, the other two beyond
    f.update([0, 9000, 0])
    expect(f.counts()).toMatchObject({ lod0: 0, lod1: 0 })
    expect(hull0.visible).toBe(false)
  })
})
