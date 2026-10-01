// app/src/audio/rideSound.js — the sound of a ride (F-7, 2026-10-01), synthesised like the train rumble (no files):
// the L ride's train at in-car level from the front window, a bus's engine and road, the glider's wind by speed, a
// walk's quiet city, and the CTA door chime as the ride train pulls into a stop. Silent unless Sound is on (M).
import { rumbleLevel } from './rumble.js'

// The ride train heard from where you are: alongside or behind it fades with distance like any passing train; from
// the front window you are in it, so it is the close (in-car) level whatever the camera's few metres from the head.
export function trainSoundLevel(distanceM, speedMps, { soundOn = false, cab = false } = {}) {
  if (!soundOn) return 0
  return cab ? rumbleLevel(0, speedMps) : rumbleLevel(distanceM, speedMps)
}

const clamp01 = (x) => Math.max(0, Math.min(1, x))
// levels 0..1 per voice for a bus, glide or walk; engineHz is the bus engine's note
export function rideSoundLevels(kind, { speedMps = 0, soundOn = false } = {}) {
  const out = { engine: 0, engineHz: 0, road: 0, wind: 0, ambience: 0 }
  if (!soundOn) return out
  const v = Math.max(0, Number.isFinite(speedMps) ? speedMps : 0)
  if (kind === 'bus') {
    const f = clamp01(v / 11) // 40 km/h is the bus's top speed here
    Object.assign(out, { engine: +(0.22 + 0.33 * f).toFixed(4), engineHz: +(34 + 34 * f).toFixed(2), road: v > 0.5 ? +(0.12 + 0.4 * f).toFixed(4) : 0, ambience: 0.08 })
  } else if (kind === 'glide') {
    out.wind = +clamp01(0.12 + ((v - 18) / 57) ** 1.5 * 0.88 || 0.12).toFixed(4) // 18 m/s (stall) … 75 m/s (a dive)
  } else if (kind === 'walk') {
    out.ambience = 0.32
  }
  return out
}

// the chime plays as the ride train comes to rest at a stop — not on the frame you board
export const chimeAt = (prev, cur) => Boolean(prev && cur && cur.dwelling && !prev.dwelling)

function noiseBuffer(ctx, seconds, brown) {
  const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 } else d[i] = w
  }
  return buf
}

export function createRideSound(ctx) {
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination)
  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s }
  const white = noiseBuffer(ctx, 2, false), brown = noiseBuffer(ctx, 2, true)
  const filter = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b }
  const gain = () => { const g = ctx.createGain(); g.gain.value = 0; return g }

  // bus engine: a low sawtooth growl, lowpassed, over brown-noise rumble
  const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 34
  const engLp = filter('lowpass', 220), engG = gain()
  eng.connect(engLp).connect(engG).connect(out)
  // road / tyres: brown noise through a mid band
  const roadSrc = loop(brown), roadBp = filter('bandpass', 380, 0.6), roadG = gain()
  roadSrc.connect(roadBp).connect(roadG).connect(out)
  // wind: white noise through a band that opens with speed
  const windSrc = loop(white), windBp = filter('bandpass', 700, 0.5), windG = gain()
  windSrc.connect(windBp).connect(windG).connect(out)
  // the city around a walk (and under a bus): soft lowpassed noise
  const ambSrc = loop(brown), ambLp = filter('lowpass', 520), ambG = gain()
  ambSrc.connect(ambLp).connect(ambG).connect(out)
  for (const n of [eng, roadSrc, windSrc, ambSrc]) n.start()

  return {
    set({ engine = 0, engineHz = 0, road = 0, wind = 0, ambience = 0 }) {
      const t = ctx.currentTime
      engG.gain.setTargetAtTime(engine * 0.12, t, 0.3)
      if (engineHz > 0) eng.frequency.setTargetAtTime(engineHz, t, 0.4)
      roadG.gain.setTargetAtTime(road * 0.5, t, 0.3)
      windG.gain.setTargetAtTime(wind * 0.35, t, 0.4)
      windBp.frequency.setTargetAtTime(500 + wind * 1300, t, 0.4)
      ambG.gain.setTargetAtTime(ambience * 0.4, t, 0.6)
    },
    // the CTA door chime: two soft bell tones, high then low ("ding-dong")
    chime() {
      const t = ctx.currentTime
      ;[[784, 0], [622, 0.42]].forEach(([hz, at]) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz
        const g = ctx.createGain(); g.gain.value = 0
        o.connect(g).connect(out)
        g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(0.16, t + at + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + at + 1.1)
        o.start(t + at); o.stop(t + at + 1.2)
      })
    },
    stop() {
      for (const n of [eng, roadSrc, windSrc, ambSrc]) { try { n.stop() } catch { /* already stopped */ } }
      out.disconnect()
    },
  }
}
