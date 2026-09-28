import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './world/Scene.jsx'
import Hud from './hud/Hud.jsx'
import SafeLoad from './world/SafeLoad.jsx'
import { useStore } from './state/store.js'

export default function App() {
  return (
    <div className="app">
      <SafeLoad onError={(e) => useStore.getState().setLoadError(`3D view failed: ${e.message}`)}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 42, near: 5, far: 60000, position: [1900, 320, -1500] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9, preserveDrawingBuffer: true }}
      >
        <Scene />
      </Canvas>
      </SafeLoad>
      <Hud />
    </div>
  )
}
