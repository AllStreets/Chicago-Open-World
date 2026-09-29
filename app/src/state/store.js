import { create } from 'zustand'

export const useStore = create((set) => ({
  timePreset: 'LIVE',
  cameraMode: 'FLY',
  quality: 'HIGH',
  setQuality: (quality) => set({ quality }),
  readout: { streets: 'STATE & MADISON', altitude: 0, heading: 0 },
  load: { total: 0, done: 0, keys: [], error: null, ready: false },
  setTimePreset: (timePreset) => set({ timePreset }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setReadout: (readout) => set({ readout }),
  setLoadTotal: (total) => set((s) => ({ load: { ...s.load, total, ready: total === 0 } })),
  markLoaded: (key) => set((s) => {
    if (s.load.keys.includes(key)) return {}
    const keys = [...s.load.keys, key]
    return { load: { ...s.load, keys, done: keys.length, ready: keys.length >= s.load.total } }
  }),
  setLoadError: (error) => set((s) => ({ load: { ...s.load, error, ready: true } })),
}))
