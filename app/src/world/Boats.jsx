// app/src/world/Boats.jsx — F-9: the boats on the water (world/boats.json, pipeline/lib/boats.js): the slips' pleasure
// boats, the tour boats and the water taxis, each kind a scripted Blender model drawn as instances (boats/fleet.js).
// LOD0 near, LOD1 far; LOD0 casts shadows and shows in the water's mirror. Glass glows after dusk (cabins lit).
// Loaded imperatively: never holds the loading screen; a missing file draws no boats.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { worldUrl } from '../lib/manifest.js'
import { REFLECT_LAYER } from './materials/waterSurface.js'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { splitBoatModel, boatMaterials } from './boats/boatModels.js'
import { buildFleet } from './boats/fleet.js'

export default function Boats({ file, version }) {
  const [fleet, setFleet] = useState(null)
  const materials = useMemo(() => boatMaterials(), [])
  const camera = useThree((s) => s.camera)
  const eye = useRef([0, 0, 0])
  useEffect(() => {
    if (!file) return undefined
    let alive = true, built = null
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    fetch(worldUrl(file, version)).then((r) => (r.ok ? r.json() : null)).then(async (j) => {
      if (!alive || !j?.boats?.length) return
      const kinds = {}
      await Promise.all(Object.entries(j.kinds).map(async ([k, info]) => {
        try { const g = await loader.loadAsync(worldUrl(info.file, version)); kinds[k] = { ...splitBoatModel(g.scene), liveries: info.liveries, lit: info.lit } } catch (e) { console.warn('boat model failed', k, e) }
      }))
      if (!alive) return
      built = buildFleet(kinds, j.boats, materials, {
        lod1At: j.lod1At, farAt: j.farAt,
        onMesh: (m, lod) => { m.castShadow = lod === 0; m.receiveShadow = true; if (lod === 0) m.layers.enable(REFLECT_LAYER) },
      })
      setFleet(built)
    }).catch((e) => console.warn('boats failed', e))
    return () => { alive = false; built?.dispose() }
  }, [file, version, materials])
  useEffect(() => {
    if (!fleet || !new URLSearchParams(window.location.search).has('stats')) return undefined
    window.__boats = fleet.counts
    return () => { delete window.__boats }
  }, [fleet])
  useFrame(() => {
    materials.glass.emissiveIntensity = 0.42 * facadeUniforms.uNight.value
    if (!fleet) return
    const p = camera.position, e = eye.current
    if (Math.abs(p.x - e[0]) + Math.abs(p.y - e[1]) + Math.abs(p.z - e[2]) < 2 && fleet.ready) return
    e[0] = p.x; e[1] = p.y; e[2] = p.z
    fleet.update(e)
    fleet.ready = true
  })
  return fleet ? <primitive object={fleet.group} /> : null
}
