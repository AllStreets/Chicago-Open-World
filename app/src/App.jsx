import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './world/Scene.jsx'
import Hud from './hud/Hud.jsx'
import SafeLoad from './world/SafeLoad.jsx'
import { useStore } from './state/store.js'
import { QUALITY } from './lib/quality.js'

// Stable objects: R3F 9 re-applies camera/gl props whenever they are new objects.
const CAMERA = { fov: 42, near: 5, far: 60000, position: [1900, 320, -1500] }
const GL = { antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true, powerPreference: 'high-performance' }

export default function App() {
  const q = QUALITY[useStore((s) => s.quality)]
  return (
    <div className="app">
      <SafeLoad onError={(e) => useStore.getState().setLoadError(`3D view failed: ${e.message}`)}>
      <Canvas
        shadows={q.shadows}
        dpr={q.dpr}
        camera={CAMERA}
        gl={GL}
      >
        <Scene />
      </Canvas>
      </SafeLoad>
      <Hud />
    </div>
  )
}
