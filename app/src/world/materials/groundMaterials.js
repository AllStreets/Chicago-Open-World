// app/src/world/materials/groundMaterials.js — textured, world-scaled ground surfaces.
import * as THREE from 'three'

const loader = new THREE.TextureLoader()
function tex(g, name) {
  const e = g?.[name]
  if (!e) return null
  const t = loader.load(`/textures/${e.file}`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / e.sizeM, 1 / e.sizeM)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
function riverNormals() {
  const t = loader.load('/textures/waternormals.jpg')
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 40, 1 / 40)
  return t
}
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o })

export function groundMaterials(g) {
  return {
    land: mat({ map: tex(g, 'concrete'), color: '#86827a' }),
    river: mat({ color: '#1f4652', roughness: 0.08, metalness: 0.9, normalMap: riverNormals(), normalScale: new THREE.Vector2(0.35, 0.35), polygonOffset: true, polygonOffsetFactor: -2 }),
    parks: mat({ map: tex(g, 'grass'), color: '#d6e8c4', polygonOffset: true, polygonOffsetFactor: -3 }),
    pitches: mat({ map: tex(g, 'pitch'), color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -3.5 }),
    beaches: mat({ map: tex(g, 'sand'), color: '#fff7e6', polygonOffset: true, polygonOffsetFactor: -3 }),
    sidewalks: mat({ map: tex(g, 'sidewalk'), color: '#bebbb4', polygonOffset: true, polygonOffsetFactor: -4 }),
    // roads carry a faint sodium-lamp wash at night (emissiveIntensity driven by Ground)
    roads: mat({ map: tex(g, 'asphalt'), color: '#8a8a8a', roughness: 0.9, emissive: '#ffae5c', emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -6 }),
    rail: mat({ map: tex(g, 'gravel'), color: '#6b6258', polygonOffset: true, polygonOffsetFactor: -5 }),
    elevated: mat({ color: '#2f3a33', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
  }
}
