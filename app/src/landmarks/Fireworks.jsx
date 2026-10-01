// app/src/landmarks/Fireworks.jsx — Navy Pier's fireworks (user request 2026-09-29): the real summer schedule or a show
// started with X / the Fireworks button, fired from the barge off the pier's south side. The whole show is one static
// particle buffer animated on the GPU (1 draw call, also drawn into the water's reflection); each burst lights the
// towers and the lake; with Sound on, launches thump, bursts boom late by the speed of sound, and the music plays.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { useSoundStore, getAudioContext } from '../audio/soundStore.js'
import { fireworksShow, BARGE } from './fireworksSchedule.js'
import { buildShow, flashAt } from './fireworksChoreo.js'
import { showBuffers } from './fireworksBuffers.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { waterUniforms, REFLECT_LAYER } from '../world/materials/waterSurface.js'
import { createFireworksAudio } from '../audio/fireworksAudio.js'
import { createShowMusic } from '../audio/showMusic.js'
import { SCORES } from '../audio/score.js'

const SHOW = buildShow(2026)
// the classic view: from over the lakefront south-west of the pier, the skyline to the left, the barge ahead
export const FIREWORKS_VIEW = { position: [1050, 120, 250], target: [1780, 165, -900] } // from Monroe Harbor: Streeterville's towers on the left, the pier ahead
const MUSIC_M = { preview: 3000, show: 900 } // a show you started is heard across downtown; the scheduled one near the pier

const vert = /* glsl */ `
attribute float aStart; attribute vec3 aOrigin; attribute vec3 aVel; attribute vec3 aColor; attribute vec4 aParams;
uniform float uTime; uniform float uPx; uniform float uLag; uniform float uDim;
varying vec3 vC; varying float vA;
void main() {
  float life = aParams.x, drag = aParams.y, g = aParams.z, flag = floor(aParams.w / 10.0), size = aParams.w - flag * 10.0;
  float tau = uTime - uLag - aStart; // the trail pass draws every star a moment behind itself
  if (tau < 0.0 || tau > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  vec3 p; float bright;
  if (flag > 1.5) {                                   // a rising trail spark: eases up from the barge to the burst
    float k = tau / life; p = mix(aOrigin, aVel, 1.0 - (1.0 - k) * (1.0 - k)); bright = 0.9; vC = aColor;
  } else {
    float e = (1.0 - exp(-drag * tau)) / drag;
    p = aOrigin + aVel * e - vec3(0.0, g * (tau - e) / drag, 0.0);
    float k = tau / life;
    bright = exp(-2.6 * k) * (1.0 - smoothstep(0.85, 1.0, k));
    vC = mix(vec3(1.0, 0.95, 0.85), aColor, smoothstep(0.0, 0.09, k)); // a flash of white-hot, then its colour
    if (flag > 0.5) bright *= step(0.45, fract(sin(dot(aOrigin.xz + aVel.xy, vec2(12.9, 78.2)) + uTime * 37.0) * 43758.5)) * 1.6; // glitter
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx * size * 2600.0 / -mv.z * (1.0 - 0.3 * step(0.001, uLag)), 2.0, 22.0);
  vA = bright * uDim;
  gl_Position = projectionMatrix * mv;
}`
const frag = /* glsl */ `
varying vec3 vC; varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r); a = a * a * 0.6 + smoothstep(0.18, 0.0, r) * 0.9; // a hot core in a soft glow
  gl_FragColor = vec4(vC * vA * a * 3.6, 1.0);        // HDR: the bursts catch the bloom
}`

export default function Fireworks() {
  const { camera } = useThree()
  const quality = useStore((s) => s.quality), soundOn = useSoundStore((s) => s.soundOn)
  const state = useRef({ at: -1, s: null, base: 0 }), audio = useRef(null), music = useRef(null)
  const points = useMemo(() => {
    const b = showBuffers(SHOW, { fraction: quality === 'LOW' ? 0.4 : 1 })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.count * 3), 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(b.start, 1))
    g.setAttribute('aOrigin', new THREE.BufferAttribute(b.origin, 3))
    g.setAttribute('aVel', new THREE.BufferAttribute(b.vel, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(b.color, 3))
    g.setAttribute('aParams', new THREE.BufferAttribute(b.params, 4))
    const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: -100 }, uPx: { value: 1 }, uLag: { value: 0 }, uDim: { value: 1 } } })
    const p = new THREE.Points(g, m)
    p.frustumCulled = false; p.renderOrder = 7; p.visible = false
    p.layers.enable(REFLECT_LAYER)
    // the trails: the same stars a tenth of a second behind, dimmer (a second draw call sharing the geometry)
    const tm = m.clone(); tm.uniforms.uLag.value = 0.09; tm.uniforms.uDim.value = 0.45
    const trail = new THREE.Points(g, tm)
    trail.frustumCulled = false; trail.renderOrder = 7
    p.add(trail)
    return p
  }, [quality])
  useEffect(() => () => { points.geometry.dispose(); points.material.dispose(); points.children[0]?.material.dispose() }, [points])
  useEffect(() => { if (!soundOn) { audio.current?.stop(); music.current?.stop(); audio.current = music.current = null } }, [soundOn])
  useEffect(() => () => { audio.current?.stop(); music.current?.stop() }, [])
  const preview = useStore((s) => s.fireworksPreview)
  // (following, touring or riding, X's own toast already says where the show is and how to hear it)
  useEffect(() => { const s = useStore.getState(); if (preview && !useSoundStore.getState().soundOn && !(s.follow || s.tour || s.ride)) s.showToast('Sound is off — press M (or ⌘K “Sound”) to hear the fireworks') }, [preview])
  // X from far away (or facing elsewhere) flies you to a view of the barge
  useEffect(() => {
    useStore.setState({ requestFireworksView: () => {
      const v = new THREE.Vector3(...BARGE).setY(150).project(camera)
      const far = Math.hypot(camera.position.x - BARGE[0], camera.position.z - BARGE[2]) > 3000
      if (far || v.z > 1 || Math.abs(v.x) > 0.9 || Math.abs(v.y) > 0.9) useStore.getState().startFlight(FIREWORKS_VIEW, 'Navy Pier fireworks')
    } })
  }, [camera])

  useFrame(({ clock, gl }) => {
    const st = state.current, now = clock.elapsedTime
    if (now - st.at > 0.25) {
      const s = useStore.getState()
      st.at = now; st.s = fireworksShow(new Date(), { previewStart: s.fireworksPreview, stoppedAt: s.fireworksStoppedAt }); st.base = st.s.t ?? 0
      const live = st.s.state === 'show'
      if (s.fireworksLive !== live) useStore.setState({ fireworksLive: live })
      if (!live && s.fireworksPreview != null) useStore.setState({ fireworksPreview: null }) // a started show that ran its course
    }
    const live = st.s?.state === 'show', t = st.base + (now - st.at)
    points.visible = live
    const fl = live ? flashAt(SHOW, t) : null
    for (const u of [facadeUniforms, waterUniforms]) {
      if (fl && fl.intensity > 0) { u.uFlash.value.set(fl.color[0], fl.color[1], fl.color[2], fl.intensity); u.uFlashAt.value.set(...fl.pos) } else u.uFlash.value.w = 0
    }
    if (!live) { if (audio.current || music.current) { audio.current?.stop(); music.current?.stop(); audio.current = music.current = null } return }
    for (const o of [points, points.children[0]]) { o.material.uniforms.uTime.value = t; o.material.uniforms.uPx.value = gl.getPixelRatio() }
    if (!soundOn) return
    const ctx = getAudioContext()
    if (!ctx) return
    const cam = [camera.position.x, camera.position.y, camera.position.z]
    audio.current ??= createFireworksAudio(ctx)
    audio.current.tick(SHOW, t, cam)
    if (Math.hypot(cam[0] - BARGE[0], cam[2] - BARGE[2]) < (MUSIC_M[st.s.reason] ?? 900)) {
      music.current ??= createShowMusic(ctx, SCORES.fireworks)
      music.current.setPosition([BARGE[0] - 500, 10, BARGE[2] - 150]); music.current.setLevel(0.55); music.current.tick(t)
    } else if (music.current) { music.current.stop(); music.current = null }
  })
  return <primitive object={points} />
}
