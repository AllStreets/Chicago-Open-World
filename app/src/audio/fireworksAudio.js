// app/src/audio/fireworksAudio.js — the sound of a fireworks show from where you are (user request): the thump of each
// launch, the boom of each burst arriving late by the speed of sound (and duller with distance), and the crackle of
// the glitter shells. Synthesised; scheduled a moment ahead on the audio clock from the show's shell list.
export const SPEED_OF_SOUND = 343
const LOOKAHEAD_S = 0.25

export function eventsBetween(show, cam, t0, t1) {
  const out = []
  for (const s of show.shells) {
    const launchAt = s.t - s.rise
    const dl = Math.hypot(s.burst[0] - cam[0], s.burst[2] - cam[2]) // the barge is under the bursts
    const d = Math.hypot(s.burst[0] - cam[0], s.burst[1] - cam[1], s.burst[2] - cam[2])
    const launchHeard = launchAt + dl / SPEED_OF_SOUND, boomHeard = s.t + d / SPEED_OF_SOUND
    if (launchHeard >= t0 && launchHeard < t1) out.push({ kind: 'launch', at: launchHeard, d: dl, s })
    if (boomHeard >= t0 && boomHeard < t1) out.push({ kind: s.kind === 'crackle' ? 'crackle' : 'boom', at: boomHeard, d, s })
  }
  return out
}
export const loudness = (d) => 1 / (1 + (d / 700) ** 2)

export function createFireworksAudio(ctx) {
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination)
  const n = ctx.sampleRate, buf = ctx.createBuffer(1, n, ctx.sampleRate), data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  let last = null
  const noise = (when, dur, lp, peak, decay) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
    src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = lp
    src.connect(f).connect(g).connect(out)
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(peak, when + 0.008); g.gain.setTargetAtTime(0.0001, when + 0.01, decay)
    src.start(when, Math.random() * 0.8); src.stop(when + dur)
  }
  const play = (e, when) => {
    const L = loudness(e.d)
    if (L < 0.01) return
    if (e.kind === 'launch') noise(when, 0.5, 260, 0.35 * L, 0.08)
    else if (e.kind === 'boom') { noise(when, 2.2, 1400 / (1 + e.d / 900), 0.9 * L * e.s.size, 0.35); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 48; o.connect(g).connect(out); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.5 * L, when + 0.01); g.gain.setTargetAtTime(0.0001, when + 0.02, 0.25); o.start(when); o.stop(when + 1.5) }
    else for (let k = 0; k < 14; k++) noise(when + 0.3 + Math.random() * 1.4, 0.05, 5000, 0.18 * L, 0.012) // the crackle
  }
  return {
    tick(show, showT, cam) {
      const from = last == null || showT < last || showT - last > 1 ? showT : last + LOOKAHEAD_S
      const to = showT + LOOKAHEAD_S
      if (to <= from) return
      for (const e of eventsBetween(show, cam, from, to)) play(e, ctx.currentTime + Math.max(0, e.at - showT))
      last = showT
    },
    stop() { out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => out.disconnect(), 1500) },
  }
}
