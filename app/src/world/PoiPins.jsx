// app/src/world/PoiPins.jsx — the places layer (P4 · I-4.1): rooftop pins for bars, restaurants, venues and the rest,
// one InstancedMesh (1 draw call) of screen-space quads that stay ~22 px at any distance: a dark disc, a restrained
// cyan rim, the category's Remix glyph. Shown in the VISIT lens or with the Places button. Picking is screen-space
// (pickPin), asked first by the Picker so a pin wins over the building behind it.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Ri from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { POI_CATEGORIES } from '../data/poiCategories.js'
import { filterPois, MAX_PINS } from '../lib/poiFilter.js'
import { allTilePois, usePoiVersion } from './poiRegistry.js'
import { loadLivePlaces } from './livePlaces.js'

const PIN_PX = 26, CELL = 64, N = POI_CATEGORIES.length

// the ten glyphs, drawn once into a 1-row atlas
function glyphAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = CELL * N; canvas.height = CELL
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const ctx = canvas.getContext('2d')
  POI_CATEGORIES.forEach(({ icon }, i) => {
    const svg = renderToStaticMarkup(createElement(Ri[icon] ?? Ri.RiMapPin2Line, { size: 40, color: '#eaf6ff' }))
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, i * CELL + 12, 12, 40, 40); tex.needsUpdate = true }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  return tex
}

const vert = /* glsl */ `
attribute vec3 aPos; attribute float aIcon; attribute float aHot;
uniform vec2 uViewport; uniform float uPx;
varying vec2 vUv; varying float vIcon; varying float vHot;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
  float px = uPx * (1.0 + 0.25 * aHot);
  c.xy += position.xy * px / uViewport * 2.0 * c.w;
  gl_Position = c;
  vUv = position.xy + 0.5; vIcon = aIcon; vHot = aHot;
}`
const frag = /* glsl */ `
uniform sampler2D uAtlas; uniform float uN;
varying vec2 vUv; varying float vIcon; varying float vHot;
void main() {
  vec2 d = vUv - 0.5; float r = length(d);
  if (r > 0.5) discard;
  float rim = smoothstep(0.40, 0.44, r) * (1.0 - smoothstep(0.47, 0.5, r));
  vec4 g = texture2D(uAtlas, vec2((vIcon + vUv.x) / uN, vUv.y));
  vec3 col = mix(vec3(0.035, 0.055, 0.1), vec3(0.92, 0.97, 1.0), g.a * (1.0 - smoothstep(0.4, 0.44, r)));
  col = mix(col, vec3(0.27, 0.85, 1.0), rim * (0.55 + 0.45 * vHot));
  gl_FragColor = vec4(col, 0.92);
}`

// the pins on screen last frame, for picking
let shown = []
export function pickPin(clientX, clientY, maxPx = 13) {
  let best = null, bd = maxPx
  for (const s of shown) { const d = Math.hypot(s.sx - clientX, s.sy - clientY); if (d < bd) { bd = d; best = s.poi } }
  return best
}

export default function PoiPins({ max: maxProp } = {}) {
  const on = useStore((s) => s.lens === 'VISIT' || s.placesOn)
  const visiting = useStore((s) => s.lens === 'VISIT')
  useEffect(() => { if (visiting) loadLivePlaces() }, [visiting]) // CHI's live places, once per session
  const cats = useStore((s) => s.poiCats), quality = useStore((s) => s.quality)
  const readout = useStore((s) => s.readout), hotId = useStore((s) => s.hover?.poiId)
  const version = usePoiVersion()
  const { gl, camera, size } = useThree()
  const cap = maxProp ?? MAX_PINS[quality] ?? MAX_PINS.HIGH
  const atlas = useMemo(() => glyphAtlas(), [])
  const mesh = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA * 3), 3))
    g.setAttribute('aIcon', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA), 1))
    g.setAttribute('aHot', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA), 1))
    g.instanceCount = 0
    const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: { uAtlas: { value: atlas }, uN: { value: N }, uViewport: { value: new THREE.Vector2(1, 1) }, uPx: { value: PIN_PX } } })
    const mesh = new THREE.Mesh(g, m)
    mesh.frustumCulled = false
    mesh.renderOrder = 5
    return mesh
  }, [atlas])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose(); atlas.dispose() }, [mesh, atlas])
  const list = useRef([])
  // what to pin: re-chosen when tiles, filters or the camera target (per 100 m) change
  const tx = Math.round((readout.x ?? 0) / 100) * 100, tz = Math.round((readout.z ?? 0) / 100) * 100
  useEffect(() => {
    const pois = on ? filterPois(allTilePois(), { cats, target: [tx, tz], max: cap }) : []
    list.current = pois
    const g = mesh.geometry, P = g.attributes.aPos.array, I = g.attributes.aIcon.array, H = g.attributes.aHot.array
    pois.forEach((p, i) => { P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; I[i] = p.c; H[i] = p.id === hotId ? 1 : 0 })
    g.instanceCount = pois.length
    g.attributes.aPos.needsUpdate = g.attributes.aIcon.needsUpdate = g.attributes.aHot.needsUpdate = true
    if (!pois.length) shown = []
  }, [on, cats, tx, tz, cap, version, mesh, hotId])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    mesh.material.uniforms.uViewport.value.set(size.width, size.height)
    if (!on) return
    // screen positions for picking (the canvas rect, CSS pixels)
    const r = gl.domElement.getBoundingClientRect(), out = []
    for (const p of list.current) {
      v.set(p.x, p.y, p.z).project(camera)
      if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue
      out.push({ poi: p, sx: r.left + ((v.x + 1) / 2) * r.width, sy: r.top + ((1 - v.y) / 2) * r.height })
    }
    shown = out
  })
  return on ? <primitive object={mesh} /> : null
}
