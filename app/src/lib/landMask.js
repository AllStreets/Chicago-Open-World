// app/src/lib/landMask.js — "is this point over Lake Michigan / the river?" from the city land rings.
export function makeIsWater(rings) {
  if (!rings?.length) return () => false
  const inRing = (x, z, r) => {
    let inside = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i], [xj, zj] = r[j]
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
    }
    return inside
  }
  return (x, z) => !rings.some((r) => inRing(x, z, r))
}
