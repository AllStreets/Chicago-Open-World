// app/src/lib/doubleTap.js — phones don't send dblclick for a double tap, so the camera rig counts taps itself.
// A tap is a primary touch that lifts within TAP_MS having moved under MOVE_PX; two taps within GAP_MS and NEAR_PX
// of each other are a double tap. Times are the events' own timeStamps, never the time the handler happens to run.
export const TAP_MS = 250, MOVE_PX = 10, GAP_MS = 320, NEAR_PX = 30

export function createDoubleTap(onDouble) {
  let start = null, last = null
  return {
    down(e) { if (e.pointerType === 'touch' && e.isPrimary) start = { x: e.clientX, y: e.clientY, t: e.timeStamp } },
    up(e) {
      if (e.pointerType !== 'touch' || !start) return false
      const t = e.timeStamp
      const tap = t - start.t < TAP_MS && Math.hypot(e.clientX - start.x, e.clientY - start.y) < MOVE_PX
      start = null
      if (!tap) { last = null; return false }
      if (last && t - last.t < GAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < NEAR_PX) { last = null; onDouble(e); return true }
      last = { x: e.clientX, y: e.clientY, t }
      return false
    },
  }
}
