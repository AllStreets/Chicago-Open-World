// app/src/world/Lake.jsx — Lake Michigan: the pipeline's baked lake mesh (land and mapped water cut out,
// 120 × 160 km) in the one shared water material. Loaded imperatively: it never holds the loading screen.
import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { waterMaterial } from './materials/waterSurface.js'
import { worldUrl } from '../lib/manifest.js'
import { disposeObject } from './dispose.js'

export default function Lake({ file, version }) {
  const [scene, setScene] = useState(null)
  useEffect(() => {
    let alive = true, loaded = null
    new GLTFLoader().loadAsync(worldUrl(file, version)).then((g) => {
      loaded = g.scene
      g.scene.traverse((o) => { if (o.isMesh) { o.material = waterMaterial; o.receiveShadow = false; o.frustumCulled = false } })
      if (alive) setScene(g.scene); else disposeObject(g.scene)
    }).catch((e) => console.warn('lake failed', e))
    return () => { alive = false; disposeObject(loaded) }
  }, [file, version])
  return scene ? <primitive object={scene} /> : null
}
