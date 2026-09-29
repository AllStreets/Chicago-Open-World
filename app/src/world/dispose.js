// app/src/world/dispose.js — free the GPU buffers of a loaded glTF scene. Materials are shared across
// tiles (façades, ground, water) and are never disposed here.
export function disposeObject(root) {
  let n = 0
  root?.traverse?.((o) => { if (o.geometry) { o.geometry.dispose(); n++ } })
  return n
}
