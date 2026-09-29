// app/src/transit/pick.js — InstancedMesh.raycast caches its bounding sphere on first use and never refreshes it;
// a pick mesh whose instances move every frame must recompute it, or clicks miss (V4 review #1).
export function refreshPickBounds(mesh) {
  mesh.computeBoundingSphere()
}
