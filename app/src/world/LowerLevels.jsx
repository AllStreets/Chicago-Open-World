// app/src/world/LowerLevels.jsx — Chicago's streets under the streets (D2-2/D2-3): Lower Wacker, Lower Michigan, Lower
// Columbus, Lower (and Lower Lower) Randolph … built from lower-levels.json (lowerLevels.js) as ONE self-lit mesh — the
// sun never reaches them: strip lights every 12 m pool their light on the roadway, and away from the lamps it falls
// dark. Drawn only when it can be seen: in the U cut-away, on a ride, or low (under 120 m) within 600 m of them; from
// the air the street hides them and nothing above ground changes. Not pickable (clicks go to the city above).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { readLowerLevels } from '../lib/levels.js'
import { worldUrl } from '../lib/manifest.js'
import { buildLowerDecks, cutMask, LOWER } from './lowerLevels.js'
import { cutUniforms, setCutMask } from './materials/cutaway.js'
import { BOOKMARKS } from '../lib/bookmarks.js'

export const SHOW = { belowM: 120, withinM: 600, fadeS: 0.6 }

export const LOWER_VERT = /* glsl */ `
attribute vec3 _col;
attribute float _s;
attribute float _lit;
varying vec3 vCol;
varying float vS;
varying float vLit;
varying float vDist;
#include <fog_pars_vertex>
void main() {
  vCol = _col; vS = _s; vLit = _lit;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
export const LOWER_FRAG = /* glsl */ `
uniform float uLampM;
uniform float uBoost;   // the cut-away: daylight falls in through the opened street
uniform float uFar;     // underneath, the far roadway falls into the dark (0 = no falloff)
varying vec3 vCol;
varying float vS;
varying float vLit;
varying float vDist;
#include <fog_pars_fragment>
void main() {
  float m = mod(vS, uLampM), d = min(m, uLampM - m);
  float pool = exp(-d * d / 18.0);
  // the lamps (vLit > 2) glow; surfaces take a little general light, a warm pool under each lamp, and in the cut-away
  // some daylight falling in through the opened street; the accent tops (1 < vLit ≤ 2) glow on their own
  vec3 c = vLit > 1.0 ? vCol * vLit : vCol * (vLit * 0.8 + uBoost) + vCol * pool * vec3(1.0, 0.78, 0.5) * 0.55;
  float fade = uFar > 0.0 ? exp(-max(vDist - 30.0, 0.0) * uFar) : 1.0;
  gl_FragColor = vec4(mix(vec3(0.006, 0.006, 0.008), c, fade), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export function createLowerMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: LOWER_VERT, fragmentShader: LOWER_FRAG, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uLampM: { value: LOWER.lampM }, uBoost: { value: 0 }, uFar: { value: 1 / 120 } },
  })
}

export function lowerMesh(json) {
  const d = buildLowerDecks(json)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(d.position, 3))
  g.setAttribute('_col', new THREE.BufferAttribute(d.color, 3))
  g.setAttribute('_s', new THREE.BufferAttribute(d.s, 1))
  g.setAttribute('_lit', new THREE.BufferAttribute(d.lit, 1))
  g.setIndex(new THREE.BufferAttribute(d.index, 1))
  g.computeBoundingSphere()
  const mesh = new THREE.Mesh(g, createLowerMaterial())
  mesh.name = 'lower-levels'
  mesh.raycast = () => {} // not pickable: clicks pass to the street and the buildings above
  mesh.castShadow = mesh.receiveShadow = false
  return { mesh, stats: d.stats }
}

// is the camera where the lower levels can be seen without the cut-away? (low, and near them)
export function nearLower(pos, box, { belowM = SHOW.belowM, withinM = SHOW.withinM } = {}) {
  if (!box || pos[1] > belowM) return false
  const dx = Math.max(box.minX - pos[0], 0, pos[0] - box.maxX), dz = Math.max(box.minZ - pos[2], 0, pos[2] - box.maxZ)
  return Math.hypot(dx, dz) <= withinM
}

// U from far away (or looking elsewhere) flies to the view over the Loop's lower levels
export function wantsLowerView(cam, box) {
  if (!box) return false
  const [x, , z] = cam.target ?? cam.position
  const inside = x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ
  return !inside || cam.position[1] > 1500
}

export default function LowerLevels() {
  const manifest = useStore((s) => s.manifest)
  const on = useStore((s) => s.lowerLevelsOn)
  const lower = useMemo(() => readLowerLevels(manifest), [manifest])
  const [json, setJson] = useState(null)
  const camera = useThree((s) => s.camera)
  const group = useRef()
  useEffect(() => {
    if (!lower) { setJson(null); return undefined }
    let alive = true
    fetch(worldUrl(lower.file, manifest.version)).then((r) => (r.ok ? r.json() : null)).then((j) => alive && setJson(j)).catch(() => {})
    return () => { alive = false }
  }, [lower, manifest])
  const built = useMemo(() => {
    if (!json?.ways?.length) return null
    const { mesh, stats } = lowerMesh(json)
    const mask = cutMask(json)
    const box = { minX: mask.x0, minZ: mask.z0, maxX: mask.x0 + mask.width * mask.cell, maxZ: mask.z0 + mask.height * mask.cell }
    return { mesh, mask, box, stats }
  }, [json])
  useEffect(() => {
    if (!built) return undefined
    setCutMask(built.mask)
    if (new URLSearchParams(window.location.search).has('stats')) window.__lowerLevels = built.stats
    return () => { setCutMask(null); cutUniforms.uCut.value = 0; built.mesh.geometry.dispose(); built.mesh.material.dispose() }
  }, [built])
  // U on: the ⌘K / key path asks for a view over the lower levels when the camera isn't over them
  useEffect(() => {
    useStore.setState({ requestLowerLevelsView: () => {
      if (!built) return
      const dir = camera.getWorldDirection(new THREE.Vector3())
      const t = dir.y < -0.05 ? camera.position.y / -dir.y : 0
      const target = [camera.position.x + dir.x * t, 0, camera.position.z + dir.z * t]
      if (wantsLowerView({ position: camera.position.toArray(), target }, built.box)) useStore.getState().startFlight(BOOKMARKS.lowerlevels, 'Lower levels')
      useStore.getState().showToast('Lower levels — the street opens over Lower Wacker, Lower Michigan and Lower Columbus · U closes it')
    } })
    return () => useStore.setState({ requestLowerLevelsView: null })
  }, [camera, built])
  useEffect(() => { if (!lower && on) useStore.getState().setLowerLevelsOn(false) }, [lower, on])
  useFrame(({ camera: cam }, dt) => {
    if (!built || !group.current) return
    const u = cutUniforms.uCut, want = on ? 1 : 0
    if (u.value !== want) u.value = want > u.value ? Math.min(1, u.value + dt / SHOW.fadeS) : Math.max(0, u.value - dt / SHOW.fadeS)
    const ride = Boolean(useStore.getState().ride)
    group.current.visible = u.value > 0 || ride || nearLower(cam.position.toArray(), built.box)
    const mu = built.mesh.material.uniforms
    mu.uBoost.value = 0.32 * u.value
    mu.uFar.value = u.value > 0 ? 0 : 1 / 120
  })
  if (!built) return null
  return (
    <group ref={group} visible={false}>
      <primitive object={built.mesh} />
    </group>
  )
}
