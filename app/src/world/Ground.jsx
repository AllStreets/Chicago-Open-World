// app/src/world/Ground.jsx — land, water, parks, beaches, sidewalks, roads, rail, the L deck.
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useStore } from '../state/store.js'
import SafeLoad from './SafeLoad.jsx'
import { groundMaterials } from './materials/groundMaterials.js'
import { facadeUniforms } from './materials/facadeMaterial.js'

const LAYERS = ['land', 'river', 'parks', 'beaches', 'sidewalks', 'roads', 'rail', 'elevated']

function Flat({ file, material, cast }) {
  const { scene } = useGLTF(`/world/${file}`, false, false)
  const markLoaded = useStore((s) => s.markLoaded)
  const obj = useMemo(() => {
    scene.traverse((o) => { if (o.isMesh) { o.material = material; o.receiveShadow = true; o.castShadow = !!cast } })
    return scene
  }, [scene, material, cast])
  useEffect(() => { markLoaded(file) }, [markLoaded, file])
  return <primitive object={obj} />
}

export default function Ground({ ground }) {
  const [g, setG] = useState(null)
  useEffect(() => {
    fetch('/textures/ground/ground.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then(setG)
  }, [])
  const mats = useMemo(() => (g ? groundMaterials(g) : null), [g])
  useFrame((_, dt) => {
    if (!mats) return
    mats.roads.emissiveIntensity = facadeUniforms.uNight.value * 0.07
    if (mats.river.normalMap) mats.river.normalMap.offset.x += dt * 0.004 // slow current, west → east
  })
  if (!mats) return null
  const fail = (file) => (err) => { console.warn(`ground failed: ${file}`, err); useStore.getState().markLoaded(file) }
  return LAYERS.filter((k) => ground[k]).map((k) => (
    <SafeLoad key={k} onError={fail(ground[k])}>
      <Suspense fallback={null}><Flat file={ground[k]} material={mats[k]} cast={k === 'elevated'} /></Suspense>
    </SafeLoad>
  ))
}
