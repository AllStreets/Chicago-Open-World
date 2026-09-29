// app/src/audio/cheers.js — crowd murmur and cheers, synthesised from shaped noise (no audio assets), one
// positional voice per venue. Nothing is created until enable() — called only when the Sound button is on.
import { CHEER } from './cheerMath.js'
import { useSports } from '../sports/sportsStore.js'

// Phase 5 hook: a scoring event at a venue. The crowd stands; it is heard only while soundOn.
export function cheer(venueKey, strength = 1) { useSports.getState().pushSwell(venueKey, strength) }

// `shared`: AudioCtor is a getter for the one app-wide context (V4's soundStore) — used as-is, never closed here.
export function createCheers(AudioCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext, { shared = false } = {}) {
  let ctx = null, master = null, buffer = null
  const voices = new Map()
  const setPos = (n, [x, y, z]) => { if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z } else n.setPosition?.(x, y, z) }
  function ensure() {
    if (ctx || !AudioCtor) return
    ctx = shared ? AudioCtor() : new AudioCtor()
    if (!ctx) return
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination)
    const n = ctx.sampleRate * 4
    buffer = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buffer.getChannelData(0)
    let b = 0
    for (let i = 0; i < n; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 * (0.7 + 0.3 * Math.sin((i / ctx.sampleRate) * 2.1)) }
  }
  function voice(key) {
    if (voices.has(key)) return voices.get(key)
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 950; filter.Q.value = 0.6
    const gain = ctx.createGain(); gain.gain.value = 0
    const panner = ctx.createPanner()
    Object.assign(panner, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: CHEER.refDistance, maxDistance: CHEER.maxDistance, rolloffFactor: CHEER.rolloff })
    src.connect(filter).connect(gain).connect(panner).connect(master)
    src.start()
    const v = { src, filter, gain, panner, last: -1 }
    voices.set(key, v)
    return v
  }
  return {
    get created() { return !!ctx },
    get _ctx() { return ctx }, // tests only
    enable() { ensure(); return ctx?.resume?.() },
    disable() { return ctx?.suspend?.() },
    setListener(pos, fwd) {
      if (!ctx) return
      const L = ctx.listener
      if (L.positionX) { setPos(L, pos); L.forwardX.value = fwd[0]; L.forwardY.value = fwd[1]; L.forwardZ.value = fwd[2]; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0 }
      else { L.setPosition?.(...pos); L.setOrientation?.(fwd[0], fwd[1], fwd[2], 0, 1, 0) }
    },
    setVenue(key, pos, murmur, swell) {
      if (!ctx || (murmur <= 0 && swell <= 0 && !voices.has(key))) return
      const v = voice(key)
      setPos(v.panner, pos)
      const level = Math.min(1.2, murmur + swell * 0.9)
      if (Math.abs(level - v.last) > 0.005) {
        v.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.25)
        v.filter.frequency.setTargetAtTime(950 + 500 * swell, ctx.currentTime, 0.25)
        v.last = level
      }
    },
    dispose() { for (const v of voices.values()) { try { v.src.stop() } catch { /* already stopped */ } } voices.clear(); master?.disconnect?.(); if (!shared) ctx?.close?.(); ctx = null },
  }
}
