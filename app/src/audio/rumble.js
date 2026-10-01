// app/src/audio/rumble.js — a passing L train from shaped noise: a low rumble plus rail-joint clatter, no audio files.
export function rumbleLevel(distanceM, speedMps) {
  if (!Number.isFinite(distanceM) || !Number.isFinite(speedMps) || speedMps <= 0.3) return 0
  const near = 1 / (1 + (Math.max(distanceM, 5) / 35) ** 2)
  return +(near * Math.min(1, 0.25 + speedMps / 20)).toFixed(4)
}
export const clatterHz = (speedMps, carLengthM = 14.63) => (speedMps > 0.5 ? (2 * speedMps) / carLengthM : 0)

export function createRumble(ctx) {
  const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 } // brown noise
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
  const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 140
  const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 900; band.Q.value = 3
  const gain = ctx.createGain(); gain.gain.value = 0
  const clack = ctx.createGain(); clack.gain.value = 0
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0
  src.connect(low).connect(gain).connect(ctx.destination)
  src.connect(band).connect(clack).connect(ctx.destination)
  lfo.connect(lfoGain).connect(clack.gain)
  src.start(); lfo.start()
  return {
    // cab (F-7): riding in the train — the rumble lower and fuller, the rail joints duller, through the floor
    set(level, hz, cab = false) {
      const t = ctx.currentTime
      low.frequency.setTargetAtTime(cab ? 105 : 140, t, 0.3)
      band.frequency.setTargetAtTime(cab ? 620 : 900, t, 0.3)
      gain.gain.setTargetAtTime(level * (cab ? 0.75 : 0.6), t, 0.25)
      // the clatter breathes with each rail joint (a sine at half depth over a steady base) — a full-depth square gate
      // switched the sound on and off and made a followed train sound choppy
      clack.gain.setTargetAtTime(level * 0.14, t, 0.25)
      lfoGain.gain.setTargetAtTime(level * 0.07, t, 0.25)
      lfo.frequency.setTargetAtTime(Math.max(0.1, hz), t, 0.25)
    },
    stop() {
      try { src.stop(); lfo.stop() } catch { /* already stopped */ }
      gain.disconnect(); clack.disconnect()
    },
  }
}
