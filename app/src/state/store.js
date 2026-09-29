import { create } from 'zustand'

export const useStore = create((set) => ({
  timePreset: 'LIVE',
  cameraMode: 'FLY',
  quality: 'HIGH',
  introDone: false,
  flight: null,
  startFlight: (to, label = null) => set({ flight: { to, label, id: Date.now() + Math.random() } }),
  clearFlight: () => set({ flight: null }),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  viewIndex: 0,
  setViewIndex: (viewIndex) => set({ viewIndex }),
  cam: null,
  camCommand: (type, amount = 0) => set({ cam: { type, amount, id: Date.now() + Math.random() } }),
  manifest: null,
  isWater: null,
  setIsWater: (isWater) => set({ isWater }),
  setManifest: (manifest) => set({ manifest }),
  flyTo: null,
  requestFlyTo: (x, z) => set({ flyTo: { x, z, id: Date.now() } }),
  clearFlyTo: () => set({ flyTo: null }),
  finishIntro: () => set({ introDone: true }),
  setQuality: (quality) => set({ quality }),
  readout: { streets: 'STATE & MADISON', altitude: 0, heading: 0 },
  load: { total: 0, done: 0, keys: [], error: null, ready: false },
  setTimePreset: (timePreset) => set({ timePreset }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setReadout: (readout) => set({ readout }),
  setLoadTotal: (total) => set((s) => ({ load: { ...s.load, total, ready: total === 0 } })),
  addLoadTotal: (n) => set((s) => ({ load: { ...s.load, total: s.load.total + n, ready: s.load.keys.length >= s.load.total + n } })),
  markLoaded: (key) => set((s) => {
    if (s.load.keys.includes(key)) return {}
    const keys = [...s.load.keys, key]
    return { load: { ...s.load, keys, done: keys.length, ready: keys.length >= s.load.total } }
  }),
  setLoadError: (error) => set((s) => ({ load: { ...s.load, error, ready: true } })),
}))
