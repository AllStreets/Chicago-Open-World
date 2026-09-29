// app/src/landmarks/crownFace.js — Crown Fountain's 5-minute cycle per face: a 40 s clip at one-third speed
// forward and back for 4 min, then 15 s pucker, 30 s spout, 15 s smile; ~1,000 faces in random rotation;
// water runs May–October (https://en.wikipedia.org/wiki/Crown_Fountain).
import { chicagoClock } from '../lib/chicagoTime.js'
export const CROWN_CYCLE = { period: 300, holdS: 240, puckerS: 15, spoutS: 30, smileS: 15, faces: 1000 }
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
export function crownFace(tSec, { waterOn = true } = {}) {
  const C = CROWN_CYCLE, k = Math.floor(tSec / C.period), s = tSec - k * C.period, face = Math.floor(hash(k) * C.faces)
  if (s < C.holdS) return { face, phase: 'hold', pucker: 0, smile: 0, spout: 0 }
  if (s < C.holdS + C.puckerS) return { face, phase: 'pucker', pucker: (s - C.holdS) / C.puckerS, smile: 0, spout: 0 }
  if (s < C.holdS + C.puckerS + C.spoutS) return { face, phase: 'spout', pucker: 1, smile: 0, spout: waterOn ? 1 : 0 }
  return { face, phase: 'smile', pucker: 0, smile: 1, spout: 0 }
}
export const crownWaterOn = (date) => { const m = chicagoClock(date).month; return m >= 5 && m <= 10 }
