// app/src/sports/venueFocus.js — the camera pose that shows a venue's game (V7 wraps it with clearanceAt).
export function venueFocusPose(venue) {
  const [cx, cz] = venue.center
  const f = venue.frame
  if (f && venue.kind === 'baseball') {
    const [o, a] = [f.origin, f.axis]
    return { position: [o[0] - a[0] * 150, 105, o[1] - a[1] * 150], target: [o[0] + a[0] * 60, 5, o[1] + a[1] * 60] }
  }
  if (f) {
    const L = [f.axis[1], -f.axis[0]]
    return { position: [f.origin[0] + L[0] * 190, 120, f.origin[1] + L[1] * 190], target: [f.origin[0], 5, f.origin[1]] }
  }
  return { position: [cx + 230, 190, cz + 270], target: [cx, 15, cz] }
}
