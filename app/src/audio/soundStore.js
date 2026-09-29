// app/src/audio/soundStore.js — one switch for every sound in the city (train rumble now, crowd cheers in V5).
// Off by default; the AudioContext is created only after the person turns sound on (browsers require a gesture).
import { create } from 'zustand'

let ctx = null
export function getAudioContext() {
  if (!ctx && typeof window !== 'undefined') {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) { try { ctx = new AC() } catch { ctx = null } }
  }
  return ctx
}

export const useSoundStore = create((set) => ({
  soundOn: false,
  setSoundOn: (soundOn) => {
    if (soundOn) { try { getAudioContext()?.resume?.() } catch { /* blocked: stay silent, keep the switch */ } }
    set({ soundOn })
  },
  toggleSound: () => useSoundStore.getState().setSoundOn(!useSoundStore.getState().soundOn),
}))
export const soundStore = useSoundStore
