// app/src/lib/tour.js — tour playback as a pure function of time (P4 · I-4.2): dwell on a stop with its card, fly to
// the next (the same flight timing as any ⌘K flight), dwell, … until the last stop's dwell ends.
import { flightDuration, flyPose } from './flight.js'

function legs(tour, poses) {
  const out = []
  tour.stops.forEach((s, i) => {
    if (i > 0) out.push({ kind: 'fly', stop: i, dur: flightDuration(poses[i - 1], poses[i]) })
    out.push({ kind: 'dwell', stop: i, dur: s.dwell ?? 8 })
  })
  return out
}

export function tourDuration(tour, poses) { return legs(tour, poses).reduce((a, l) => a + l.dur, 0) }

// the start time of each stop's dwell (for Previous / Next and the scrubber's ticks)
export function stopStarts(tour, poses) {
  const starts = []
  let t = 0
  for (const l of legs(tour, poses)) { if (l.kind === 'dwell') starts[l.stop] = t; t += l.dur }
  return starts
}

export function tourAt(tour, poses, tSec) {
  const L = legs(tour, poses), total = L.reduce((a, l) => a + l.dur, 0)
  const last = tour.stops.length - 1
  if (tSec >= total) return { stopIndex: last, phase: 'dwell', pose: poses[last], card: { title: tour.stops[last].title, text: tour.stops[last].text }, progress: 1, done: true }
  let t = Math.max(0, tSec)
  for (const l of L) {
    if (t < l.dur) {
      const s = tour.stops[l.stop], card = { title: s.title, text: s.text }
      const pose = l.kind === 'dwell' ? poses[l.stop] : flyPose(poses[l.stop - 1], poses[l.stop], t / l.dur)
      return { stopIndex: l.stop, phase: l.kind, pose, card, progress: Math.max(0, tSec) / total, done: false }
    }
    t -= l.dur
  }
  return { stopIndex: last, phase: 'dwell', pose: poses[last], card: { title: tour.stops[last].title, text: tour.stops[last].text }, progress: 1, done: true }
}
