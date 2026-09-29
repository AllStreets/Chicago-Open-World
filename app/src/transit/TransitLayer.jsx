// app/src/transit/TransitLayer.jsx — draws the pooled track structure, stations and line glow;
// keeps the glow's viewport/fov uniforms, line mask and on/off in step with the app.
import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { QUALITY } from '../lib/quality.js'
import { getTransitPools } from './pools.js'
import { glowUniforms, structureUniforms, setLineMask } from './transitMaterials.js'

export default function TransitLayer() {
  const pools = getTransitPools()
  const quality = useStore((s) => s.quality)
  const on = useStore((s) => s.transitOn)
  const hidden = useStore((s) => s.hiddenLines)
  const lines = useStore((s) => s.transit?.lines)
  useEffect(() => { setLineMask(lines ?? [], hidden) }, [lines, hidden])
  useEffect(() => { structureUniforms.uAccent.value = on ? 1 : 0; pools.glow.mesh.visible = on }, [on, pools])
  useEffect(() => { if (new URLSearchParams(window.location.search).has('stats')) window.__transitPools = pools }, [pools])
  useFrame(({ camera, size, gl }) => {
    glowUniforms.uViewportH.value = size.height * gl.getPixelRatio()
    glowUniforms.uTanHalfFov.value = Math.tan(((camera.fov ?? 42) * Math.PI) / 360)
  })
  return (
    <>
      <primitive object={pools.structure.mesh} castShadow={QUALITY[quality].shadows} receiveShadow />
      <primitive object={pools.glow.mesh} renderOrder={2} />
    </>
  )
}
