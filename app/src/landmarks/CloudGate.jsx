// app/src/landmarks/CloudGate.jsx — the Bean in polished steel, mirroring the live sky and skyline.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { worldUrl } from '../lib/manifest.js'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { CUBE, CUBE_STEPS, cubeStepFor, cubeActive, renderCubePart } from './cubeFaces.js'

export default function CloudGate({ file, version, centre }) {
  const { scene: glb } = useGLTF(worldUrl(file, version), false, true)
  const quality = useStore((s) => s.quality)
  const { gl, scene, camera } = useThree()
  // 8-bit sRGB with trilinear mips: half-float cube targets can lose linear filtering on some GPUs, which drew
  // the 128 px faces as hard blocks; the mips let roughness soften the reflection a touch.
  const rt = useMemo(() => new THREE.WebGLCubeRenderTarget(CUBE.size, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter }), [])
  const cubeCam = useMemo(() => new THREE.CubeCamera(CUBE.near, CUBE.far, rt), [rt])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f4f6', metalness: 1, roughness: 0.1 }), [])
  const geo = useMemo(() => { let g = null; glb.traverse((o) => { if (o.isMesh && !g) g = o.geometry }); return g }, [glb])
  const bean = useRef(), frame = useRef(0), primed = useRef(0) // steps of the first fill rendered so far
  useEffect(() => () => { rt.dispose(); mat.dispose() }, [rt, mat])
  useFrame(() => {
    const active = cubeActive({ quality, camDist: Math.hypot(camera.position.x - centre[0], camera.position.z - centre[1]) })
    // the sky (scene.environment) at LOW, far away, and until every face of a first fill is in
    const env = active && primed.current >= CUBE_STEPS ? rt.texture : null
    if (mat.envMap !== env) { mat.envMap = env; mat.needsUpdate = true }
    if (!active || !bean.current) { primed.current = 0; return }
    if (cubeCam.coordinateSystem !== gl.coordinateSystem) { cubeCam.coordinateSystem = gl.coordinateSystem; cubeCam.updateCoordinateSystem() }
    cubeCam.position.set(centre[0], 5, centre[1]); cubeCam.updateMatrixWorld(true)
    // first sight: one slice a frame through all six faces; then the refresh schedule
    const step = primed.current < CUBE_STEPS ? cubeStepFor(primed.current++) : cubeStepFor(frame.current++)
    if (!step) return
    bean.current.visible = false
    renderCubePart(gl, rt, scene, cubeCam, step.face, step.part)
    bean.current.visible = true
  })
  return geo ? <mesh ref={bean} geometry={geo} material={mat} castShadow receiveShadow /> : null
}
