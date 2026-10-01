// app/src/transit/Tunnels.jsx — the subway tubes and underground stations (tunnels.js), two draw calls, drawn only
// when the camera is at street level or below: from the air the ground hides them, and the view above is unchanged.
// Self-lit: the sun doesn't reach a tube; lamps every 15 m pool light along it and the far end falls into the dark.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { buildTunnels, setActiveTunnels, TUNNEL } from './tunnels.js'
import { readLevels } from '../lib/levels.js'

export const SHOW_BELOW_M = 25 // camera altitude under which the tubes are drawn (portals are only seen from low down)
// below this the camera is in a tube. In the flat world anything under the street was; with the river at its real
// depth (D1) a walker on the Riverwalk is 3.6 m under the street, in the open: only below the tubes' mouth is "underground"
export const undergroundBelow = (levels) => (levels?.river ? TUNNEL.mouthY : 0)

export const TUNNEL_VERT = /* glsl */ `
attribute vec3 _col;
attribute float _s;
attribute float _lit;
varying vec3 vCol;
varying float vS;
varying float vLit;
varying float vDist;
void main() {
  vCol = _col; vS = _s; vLit = _lit;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`
export const TUNNEL_FRAG = /* glsl */ `
uniform float uLampM;
varying vec3 vCol;
varying float vS;
varying float vLit;
varying float vDist;
void main() {
  float m = mod(vS, uLampM), d = min(m, uLampM - m);
  float pool = exp(-d * d / 22.0);                       // light pooling under each lamp
  float light = vLit > 2.0 ? vLit : vLit * (0.75 + 0.25 * pool) + 0.55 * pool * step(vLit, 0.5);
  vec3 c = vCol * light;
  float fade = exp(-max(vDist - 25.0, 0.0) / 150.0);     // the far tube falls into the dark
  gl_FragColor = vec4(mix(vec3(0.008, 0.009, 0.012), c, fade), 1.0);
  #include <colorspace_fragment>
}`

export function createTunnelMaterial() {
  return new THREE.ShaderMaterial({ vertexShader: TUNNEL_VERT, fragmentShader: TUNNEL_FRAG, uniforms: { uLampM: { value: TUNNEL.lampM } }, fog: false })
}

// one atlas row per station name: CTA-style white Helvetica on black
function signAtlas(names) {
  const rows = Math.max(1, names.length), W = 1024, H = 192, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null
  const ctx = cv?.getContext?.('2d')
  if (!ctx) return null
  cv.width = W; cv.height = H * rows
  names.forEach((n, i) => {
    ctx.fillStyle = '#111214'; ctx.fillRect(0, i * H, W, H)
    ctx.fillStyle = '#f4f4f0'; ctx.font = 'bold 104px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
    ctx.fillText(n, W / 2, i * H + H / 2 + 4, W - 80)
  })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  return tex
}

export default function Tunnels() {
  const transit = useStore((s) => s.transit)
  const manifest = useStore((s) => s.manifest)
  const below = useMemo(() => undergroundBelow(readLevels(manifest)), [manifest])
  const group = useRef()
  const built = useMemo(() => {
    if (!transit?.routes) return null
    const t = buildTunnels(transit)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(t.tube.position, 3))
    g.setAttribute('_col', new THREE.BufferAttribute(t.tube.color, 3))
    g.setAttribute('_s', new THREE.BufferAttribute(t.tube.s, 1))
    g.setAttribute('_lit', new THREE.BufferAttribute(t.tube.lit, 1))
    g.setIndex(new THREE.BufferAttribute(t.tube.index, 1))
    g.computeBoundingSphere()
    const tube = new THREE.Mesh(g, createTunnelMaterial())
    tube.name = 'tunnels'
    tube.raycast = () => {} // not pickable: clicks pass to the trains and stations
    let signs = null
    const atlas = signAtlas(t.names)
    if (atlas && t.signs.index.length) {
      const sg = new THREE.BufferGeometry()
      sg.setAttribute('position', new THREE.BufferAttribute(t.signs.position, 3))
      sg.setAttribute('uv', new THREE.BufferAttribute(t.signs.uv, 2))
      sg.setIndex(new THREE.BufferAttribute(t.signs.index, 1))
      sg.computeBoundingSphere()
      signs = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: atlas, fog: false, toneMapped: false }))
      signs.name = 'tunnel-signs'
      signs.raycast = () => {}
    }
    return { t, tube, signs }
  }, [transit])
  useEffect(() => {
    if (!built) return
    setActiveTunnels(built.t)
    return () => { setActiveTunnels(null); built.tube.geometry.dispose(); built.tube.material.dispose(); built.signs?.geometry.dispose(); built.signs?.material.map?.dispose(); built.signs?.material.dispose() }
  }, [built])
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = camera.position.y < SHOW_BELOW_M
    const under = camera.position.y < below, s = useStore.getState()
    if (s.underground !== under) s.setUnderground(under)
  })
  if (!built) return null
  return (
    <group ref={group} visible={false}>
      <primitive object={built.tube} />
      {built.signs && <primitive object={built.signs} />}
    </group>
  )
}
