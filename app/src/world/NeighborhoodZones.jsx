// app/src/world/NeighborhoodZones.jsx — the LIVE lens's neighbourhoods (P4 · I-4.3): each zone's edge as a soft band of
// ground light fading 40 m inward (one merged additive mesh, 1 draw call), the selected zone brighter, names on the
// label layer. Loads neighborhoods.json once (the store keeps it for the cards and the panel).
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { worldUrl } from '../lib/manifest.js'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { setLabels } from './labelRegistry.js'

// wide enough to read from a few kilometres up; soft (alpha²); 3 m up and depth-offset, because from 2–3 km the depth
// buffer can't tell a band half a metre above the ground from the ground itself (it vanished) — towers still hide it
const BAND = 110, Y = 3

function bandMesh(zones) {
  const pos = [], alpha = [], zone = []
  zones.forEach((zn, zi) => {
    const r = zn.ring, n = r.length
    let area = 0
    for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1] }
    const inward = area > 0 ? 1 : -1 // the side of each edge the zone lies on
    const inner = r.map((p, i) => {
      const a = r[(i - 1 + n) % n], b = r[(i + 1) % n]
      let nx = -(b[1] - a[1]) * inward, nz = (b[0] - a[0]) * inward
      const l = Math.hypot(nx, nz) || 1
      return [p[0] + (nx / l) * BAND, p[1] + (nz / l) * BAND]
    })
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, o0 = r[i], o1 = r[j], i0 = inner[i], i1 = inner[j]
      for (const [p, al] of [[o0, 1], [o1, 1], [i1, 0], [o0, 1], [i1, 0], [i0, 0]]) { pos.push(p[0], Y, p[1]); alpha.push(al); zone.push(zi) }
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alpha, 1))
  g.setAttribute('aZone', new THREE.Float32BufferAttribute(zone, 1))
  return g
}

export default function NeighborhoodZones() {
  const manifest = useStore((s) => s.manifest), hoods = useStore((s) => s.hoods)
  const on = useStore((s) => s.lens === 'LIVE'), sel = useStore((s) => (s.selection?.kind === 'neighborhood' ? s.selection.id : null))
  useEffect(() => {
    if (!manifest?.neighborhoods || useStore.getState().hoods) return
    fetch(worldUrl(manifest.neighborhoods, manifest.version)).then((r) => r.json()).then((j) => useStore.setState({ hoods: j.zones ?? [] })).catch(() => {})
  }, [manifest])
  const zones = useMemo(() => hoods ?? [], [hoods])
  const mesh = useMemo(() => {
    if (!zones.length) return null
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
      uniforms: { uNight: facadeUniforms.uNight, uSelected: { value: -1 } },
      vertexShader: 'attribute float aAlpha; attribute float aZone; varying float vA; varying float vZ; void main(){ vA = aAlpha; vZ = aZone; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uNight; uniform float uSelected; varying float vA; varying float vZ; void main(){ float s = abs(vZ - uSelected) < 0.5 ? 1.0 : 0.0; float a = vA * vA * mix(0.4, 0.6, uNight) * (1.0 + 1.4 * s); gl_FragColor = vec4(mix(vec3(0.27, 0.85, 1.0), vec3(0.75, 0.95, 1.0), s) * a, a); }',
    })
    const mesh = new THREE.Mesh(bandMesh(zones), m)
    mesh.renderOrder = 3; mesh.frustumCulled = false
    return mesh
  }, [zones])
  useEffect(() => () => { mesh?.geometry.dispose(); mesh?.material.dispose() }, [mesh])
  useEffect(() => { if (mesh) mesh.material.uniforms.uSelected.value = zones.findIndex((z) => z.id === sel) }, [mesh, zones, sel])
  useEffect(() => {
    setLabels('zones', on ? zones.map((z) => ({ id: `hood:${z.id}`, x: z.label[0], y: 30, z: z.label[1], priority: 2, fadeNear: 4000, fadeFar: 12000, text: z.name, color: '#45d8ff', onClick: () => openZone(z) })) : [])
    return () => setLabels('zones', [])
  }, [on, zones])
  return on && mesh ? <primitive object={mesh} /> : null
}

export function openZone(z) {
  const s = useStore.getState()
  if (s.lens !== 'LIVE') s.setLens('LIVE')
  s.select({ kind: 'neighborhood', id: z.id, data: z })
  const d = Math.max(900, Math.sqrt(z.areaKm2 ?? 2) * 900)
  s.startFlight({ position: [z.label[0] + d * 0.5, d * 0.7, z.label[1] + d * 0.7], target: [z.label[0], 0, z.label[1]] }, z.name)
}
