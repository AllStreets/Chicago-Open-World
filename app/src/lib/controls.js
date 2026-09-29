// app/src/lib/controls.js — continuous keyboard intent, Google-Earth-style.
// Arrows/WASD move · Shift+arrows turn & tilt · Q/E turn · R/F or PageUp/PageDown up & down · +/− zoom.
export function keyIntent(keys) {
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight')
  const has = (c) => keys.has(c)
  let fwd = 0, right = 0, turn = 0, tilt = 0, climb = 0, zoom = 0
  if (has('KeyW')) fwd += 1
  if (has('KeyS')) fwd -= 1
  if (has('KeyA')) right -= 1
  if (has('KeyD')) right += 1
  if (shift) {
    if (has('ArrowLeft')) turn -= 1
    if (has('ArrowRight')) turn += 1
    if (has('ArrowUp')) tilt += 1
    if (has('ArrowDown')) tilt -= 1
  } else {
    if (has('ArrowUp')) fwd += 1
    if (has('ArrowDown')) fwd -= 1
    if (has('ArrowLeft')) right -= 1
    if (has('ArrowRight')) right += 1
  }
  if (has('KeyQ')) turn -= 1
  if (has('KeyE')) turn += 1
  if (has('KeyR') || has('PageUp')) climb += 1
  if (has('KeyF') || has('PageDown')) climb -= 1
  if (has('Equal') || has('NumpadAdd')) zoom += 1
  if (has('Minus') || has('NumpadSubtract')) zoom -= 1
  const clamp = (v) => Math.max(-1, Math.min(1, v)) || 0
  const boost = shift && (has('KeyW') || has('KeyA') || has('KeyS') || has('KeyD'))
  return { move: [clamp(fwd), clamp(right)], turn: clamp(turn), tilt: clamp(tilt), climb: clamp(climb), zoom: clamp(zoom), boost }
}
