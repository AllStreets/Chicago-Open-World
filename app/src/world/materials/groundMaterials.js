// app/src/world/materials/groundMaterials.js — textured, world-scaled ground surfaces.
import * as THREE from 'three'
import { patchCutaway } from './cutaway.js'

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
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o })

export function groundMaterials(g) {
  const land = mat({ map: tex(g, 'concrete'), color: '#86827a', polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 2 })
  land.onBeforeCompile = patchCutaway // D2-3: the land under the streets opens with them in the U view
  land.customProgramCacheKey = () => 'land-cut-v1'
  return {
    // a constant nudge back (no slope term, so the lake 2 m below can't overtake it at grazing angles)
    land,
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
