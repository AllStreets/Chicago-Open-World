// app/src/world/PoiPins.jsx — the places layer (P4 · I-4.1): rooftop pins for bars, restaurants, venues and the rest,
// one InstancedMesh (1 draw call) of screen-space quads that stay ~22 px at any distance: a dark disc, a restrained
// cyan rim, the category's Remix glyph. Shown in the VISIT lens or with the Places button. Picking is screen-space
// (pickPin), asked first by the Picker so a pin wins over the building behind it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { poiPinIcon } from '../data/poiIcons.js'
import { useStore } from '../state/store.js'
import { POI_CATEGORIES } from '../data/poiCategories.js'
import { filterPois, MAX_PINS, pinBudget, pinFocus } from '../lib/poiFilter.js'
import { allTilePois, usePoiVersion } from './poiRegistry.js'
import { loadLivePlaces } from './livePlaces.js'

const PIN_PX = 30, CELL = 128, N = POI_CATEGORIES.length
// linear RGB: the scene renders in linear light and the composer tone-maps and sRGB-encodes afterwards (display-space
// colours here were encoded twice and came out washed out)
const CAT_RGB = POI_CATEGORIES.map((c) => new THREE.Color(c.color).toArray())
// the badge's centre sits this far above the pin's tip (as a fraction of PIN_PX): picking aims at the badge
export const BADGE_UP = 0.62

// the ten solid glyphs, rasterised at size (not scaled bitmaps) into one high-resolution row, mipmapped
function glyphAtlas(maxAniso = 8) {
  const canvas = document.createElement('canvas')
  canvas.width = CELL * N; canvas.height = CELL
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAniso
  tex.minFilter = THREE.LinearMipmapLinearFilter
  const ctx = canvas.getContext('2d')
  POI_CATEGORIES.forEach(({ pin }, i) => {
    const svg = renderToStaticMarkup(createElement(poiPinIcon(pin), { size: CELL * 0.62, color: '#ffffff' }))
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, i * CELL + CELL * 0.19, CELL * 0.19, CELL * 0.62, CELL * 0.62); tex.needsUpdate = true }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  return tex
}

// A map pin drawn with signed distances in pixels (crisp at any size, anti-aliased with fwidth): a round badge in the
// category colour with a short tail down to the roof it marks, a white 1.5 px outline, a soft drop shadow, a white glyph.
const vert = /* glsl */ `
attribute vec3 aPos; attribute float aIcon; attribute float aHot; attribute vec3 aCol;
uniform vec2 uViewport; uniform float uPx;
varying vec2 vP; varying float vIcon; varying float vHot; varying vec3 vCol; varying float vS;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
  float s = uPx * (1.0 + 0.2 * aHot);
  // the quad's bottom is the pin's tip, on the anchor; it grows upward
  vec2 off = vec2(position.x, position.y + 0.5) * s * 1.2;
  c.xy += off / uViewport * 2.0 * c.w;
  c.z -= 0.0005 * c.w * aHot; // the hovered pin draws over its neighbours
  gl_Position = c;
  vP = vec2(position.x, position.y + 0.5) * 1.2; vS = s; vIcon = aIcon; vHot = aHot; vCol = aCol;
}`
const frag = /* glsl */ `
uniform sampler2D uAtlas; uniform float uN;
varying vec2 vP; varying float vIcon; varying float vHot; varying vec3 vCol; varying float vS;
float pinSd(vec2 p) {             // p in units of the pin size; badge centre (0, 0.62), radius 0.36, tail to (0, 0.02)
  vec2 c = vec2(0.0, ${BADGE_UP.toFixed(2)});
  float circle = length(p - c) - 0.36;
  vec2 q = vec2(abs(p.x), p.y - 0.02); // the tail: a narrow wedge from the tip up into the badge
  float wedge = max(dot(q, normalize(vec2(0.98, -0.30))), -q.y);
  wedge = max(wedge, q.y - 0.5);
  return min(circle, wedge);
}
void main() {
  float px = 1.0 / vS;                              // one screen pixel, in pin units
  float d = pinSd(vP);
  float aa = max(fwidth(d), px * 0.75);
  float body = 1.0 - smoothstep(-aa, aa, d);
  float shadow = (1.0 - smoothstep(-0.02, 0.12, pinSd(vP + vec2(0.0, 0.06)))) * 0.38;
  float edge = 1.0 - smoothstep(-aa, aa, d + 1.6 * px); // inside the outline
  vec3 col = mix(vec3(0.92), vCol * (0.9 + 0.1 * vHot), edge);   // white 1.5 px outline around the fill (under the bloom threshold)
  vec2 g = (vP - vec2(0.0, ${BADGE_UP.toFixed(2)})) / 0.72 + 0.5;  // the glyph inside the badge
  float glyph = (g.x > 0.0 && g.x < 1.0 && g.y > 0.0 && g.y < 1.0) ? texture2D(uAtlas, vec2((vIcon + g.x) / uN, g.y)).a : 0.0;
  col = mix(col, vec3(0.95), glyph * edge);
  float a = max(body, shadow);
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(0.0), col, body / max(a, 1e-3)), a);
}`

// the pins on screen last frame, for picking
let shown = []
export function pickPin(clientX, clientY, maxPx = PIN_PX * 0.5) {
  let best = null, bd = maxPx
  for (const s of shown) { const d = Math.hypot(s.sx - clientX, s.sy - PIN_PX * 1.2 * BADGE_UP - clientY); if (d < bd) { bd = d; best = s.poi } } // aim at the badge above the tip
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
  const alt = Math.round((readout.altitude ?? 300) / 50) * 50
  const cap = maxProp ?? pinBudget(alt, MAX_PINS[quality] ?? MAX_PINS.HIGH)
  const atlas = useMemo(() => glyphAtlas(gl.capabilities.getMaxAnisotropy?.() ?? 8), [gl])
  const mesh = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA * 3), 3))
    g.setAttribute('aIcon', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA), 1))
    g.setAttribute('aHot', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA), 1))
    g.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PINS.ULTRA * 3), 3))
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
  // what to pin: re-chosen when tiles, filters or the focus (between the camera and its target, per 80 m) change
  const [focus, setFocus] = useState([0, 0])
  const [tx, tz] = focus
  useEffect(() => {
    const pois = on ? filterPois(allTilePois(), { cats, target: [tx, tz], max: cap }) : []
    list.current = pois
    const g = mesh.geometry, P = g.attributes.aPos.array, I = g.attributes.aIcon.array, H = g.attributes.aHot.array, Cc = g.attributes.aCol.array
    pois.forEach((p, i) => { P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; I[i] = p.c; H[i] = p.id === hotId ? 1 : 0; Cc.set(CAT_RGB[p.c] ?? CAT_RGB[0], i * 3) })
    g.instanceCount = pois.length
    g.attributes.aPos.needsUpdate = g.attributes.aIcon.needsUpdate = g.attributes.aHot.needsUpdate = g.attributes.aCol.needsUpdate = true
    if (!pois.length) shown = []
  }, [on, cats, tx, tz, cap, version, mesh, hotId])
  const v = useMemo(() => new THREE.Vector3(), [])
  const tgt = useMemo(() => new THREE.Vector3(), []), lastPick = useRef(0)
  useFrame((state) => {
    mesh.material.uniforms.uViewport.value.set(size.width, size.height)
    if (!on) return
    // the focus follows the camera (the target is where it looks: the controls' target, or ahead along the view)
    camera.getWorldDirection(tgt).multiplyScalar(Math.max(200, camera.position.y * 2.5)).add(camera.position)
    const f = pinFocus(camera.position.toArray(), tgt.toArray()).map((v) => Math.round(v / 80) * 80)
    if (f[0] !== focus[0] || f[1] !== focus[1]) setFocus(f)
    // screen positions for picking, ten times a second (a few thousand projections every frame showed as jank)
    if (state.clock.elapsedTime - lastPick.current < 0.1) return
    lastPick.current = state.clock.elapsedTime
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
