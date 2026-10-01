// app/src/sports/ArenaCrown.jsx — the United Center's guide board (E3): a four-faced LED cube on a mast at the roof
// centre and a scrolling LED ribbon round the parapet. Two draw calls: the cube (faces, red trim, black body and mast —
// one mesh, one canvas, redrawn only when its words or colours change) and the ribbon (its own canvas, scrolled by
// UV offset, never redrawn to move). Self-lit (no tone mapping); brighter after dark with the façade night uniform.
// LOW quality: a half-size canvas and no ribbon.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { boardLines } from './scoreboard.js'
import { crownStyle, ribbonText, drawCrownFace, drawSwatches, drawRibbon, crownCubeGeometry, crownRibbonGeometry, faceV0For, SWATCH_H } from './arenaCrown.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

const SCROLL = 0.045 // ribbon tiles per second (≈ 3 m/s along the parapet)
const geometry = ({ position, uv, index }) => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(index)
  g.computeBoundingSphere()
  return g
}
const canvasTex = (w, h) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

export default function ArenaCrown({ venue, st, now, quality }) {
  const crown = venue.crown
  const low = quality === 'LOW'
  const W = low ? 512 : 1024, FH = W / 2
  const cube = useMemo(() => canvasTex(W, FH + (low ? SWATCH_H / 2 : SWATCH_H)), [W, FH, low])
  const rib = useMemo(() => { const t = canvasTex(2048, 64); t.wrapS = THREE.RepeatWrapping; return t }, [])
  const cubeGeo = useMemo(() => geometry(crownCubeGeometry(crown, faceV0For(1024 / 2) /* same ratio at both sizes */)), [crown])
  const ribGeo = useMemo(() => geometry(crownRibbonGeometry(crown)), [crown])
  const cubeMat = useMemo(() => new THREE.MeshBasicMaterial({ map: cube, toneMapped: false }), [cube])
  const ribMat = useMemo(() => new THREE.MeshBasicMaterial({ map: rib, toneMapped: false, side: THREE.DoubleSide }), [rib])
  const style = crownStyle(st)
  const lines = boardLines(venue, st, now)
  const words = ribbonText(lines, style)
  const key = `${style}|${JSON.stringify(lines)}|${W}`
  useEffect(() => {
    const ctx = cube.image.getContext('2d')
    drawCrownFace(ctx, lines, style, W, FH); drawSwatches(ctx, style, W, FH)
    cube.needsUpdate = true
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { drawRibbon(rib.image.getContext('2d'), words, style, 2048, 64); rib.needsUpdate = true }, [words, style, rib])
  useEffect(() => () => { cube.dispose(); cubeMat.dispose() }, [cube, cubeMat])
  useEffect(() => () => { rib.dispose(); ribMat.dispose(); cubeGeo.dispose(); ribGeo.dispose() }, [rib, ribMat, cubeGeo, ribGeo])
  useFrame((_, dt) => {
    const k = 0.86 + 0.34 * facadeUniforms.uNight.value // readable by day, glowing at night
    cubeMat.color.setScalar(k); ribMat.color.setScalar(k)
    rib.offset.x = (rib.offset.x + Math.min(dt, 0.1) * SCROLL) % 1
  })
  return (
    <group userData={{ arenaCrown: venue.key }}>
      <mesh geometry={cubeGeo} material={cubeMat} castShadow={false} receiveShadow={false} />
      {!low && <mesh geometry={ribGeo} material={ribMat} castShadow={false} receiveShadow={false} />}
    </group>
  )
}
