import { create } from 'zustand'
import { FOUNTAIN_SCHEDULE } from '../landmarks/fountainSchedule.js'

export const useStore = create((set) => ({
  timePreset: 'LIVE',
  cameraMode: 'FLY',
  quality: 'HIGH',
  introDone: false,
  flight: null,
  startFlight: (to, label = null) => set({ flight: { to, label, id: Date.now() + Math.random() }, follow: null }),
  clearFlight: () => set({ flight: null }),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  fountainPreview: null,
  startFountainPreview: () => set({ fountainPreview: Date.now(), fountainStoppedAt: null }),
  stopFountainPreview: () => set({ fountainPreview: null }),
  // stop whatever show is running (a preview or the scheduled one): back to the plain display until the next show
  fountainStoppedAt: null,
  stopFountain: () => set({ fountainPreview: null, fountainStoppedAt: Date.now() }),
  // Navy Pier fireworks (user request): a show started with X, a stop of a scheduled one, and whether one is on now
  fireworksPreview: null,
  fireworksStoppedAt: null,
  fireworksLive: false,
  startFireworks: () => set({ fireworksPreview: Date.now(), fireworksStoppedAt: null }),
  stopFireworks: () => set({ fireworksPreview: null, fireworksStoppedAt: Date.now() }),
  fountainLive: false, // a show is running now (FountainShow keeps this current, so the button lights for scheduled shows too)
  // a preview runs one show; afterwards the Fountain button goes dark by itself
  expireFountainPreview: (now) => set((s) => (s.fountainPreview != null && now - s.fountainPreview > FOUNTAIN_SCHEDULE.showMinutes * 60000 ? { fountainPreview: null } : {})),
  bridgeLift: null,
  startBridgeLift: () => set({ bridgeLift: { startedAt: Date.now(), id: Math.random() } }),
  stopBridgeLift: () => set({ bridgeLift: null }),
  lowerBridges: () => set((s) => (s.bridgeLift && !s.bridgeLift.stoppedAt ? { bridgeLift: { ...s.bridgeLift, stoppedAt: Date.now() } } : {})),
  perfOn: false,
  setPerfOn: (perfOn) => set({ perfOn }),
  perf: null,
  setPerf: (perf) => set({ perf }),
  toast: null,
  showToast: (text) => set({ toast: { text, id: Date.now() + Math.random() } }),
  clearToast: () => set({ toast: null }),
  gamesOpen: false,
  setGamesOpen: (gamesOpen) => set({ gamesOpen }),
  viewIndex: 0,
  setViewIndex: (viewIndex) => set({ viewIndex }),
  cam: null,
  camCommand: (type, amount = 0) => set({ cam: { type, amount, id: Date.now() + Math.random() }, follow: null }),
  manifest: null,
  isWater: null,
  setIsWater: (isWater) => set({ isWater }),
  setManifest: (manifest) => set({ manifest }),
  flyTo: null,
  requestFlyTo: (x, z) => set({ flyTo: { x, z, id: Date.now() } }),
  clearFlyTo: () => set({ flyTo: null }),
  finishIntro: () => set({ introDone: true }),
  setQuality: (quality) => set({ quality }),
  transit: null,
  setTransit: (transit) => set({ transit }),
  transitOn: true,
  setTransitOn: (transitOn) => set({ transitOn }),
  toggleTransit: () => set((s) => ({ transitOn: !s.transitOn })),
  hiddenLines: [],
  setHiddenLines: (hiddenLines) => set({ hiddenLines }),
  toggleLine: (id) => set((s) => ({ hiddenLines: s.hiddenLines.includes(id) ? s.hiddenLines.filter((x) => x !== id) : [...s.hiddenLines, id] })),
  follow: null,
  trafficOn: true, // cars, buses and trucks on the streets, and the traffic lights (C, ⌘K, help)
  setTrafficOn: (trafficOn) => set({ trafficOn }),
  underground: false, // the camera is in a subway tube (Tunnels.jsx): PostFX drops the city-scale AO there
  setUnderground: (underground) => set({ underground }),
  followEnded: null,
  startFollow: (trainId, view = 'chase') => set({ follow: { trainId, view }, followEnded: null, flight: null, cameraMode: 'FLY' }),
  setFollowView: (view) => set((s) => (s.follow ? { follow: { ...s.follow, view } } : {})),
  stopFollow: (reason = null) => set({ follow: null, followEnded: reason }),
  clearFollowEnded: () => set({ followEnded: null }),
  // one selection for every card: { kind: 'building' | 'landmark' | 'poi' | 'neighborhood' | 'station' | 'train' | 'office', id, data? }
  selection: null,
  select: (selection) => set({ selection }),
  clearSelection: () => set({ selection: null }),
  // the guide (P4): one lens at a time (pressing the active lens again turns it off), the office for WORK, places
  lens: null,
  setLens: (l) => set((s) => ({ lens: s.lens === l ? null : l })),
  office: null,
  setOffice: (office) => set({ office, officeArmed: false }),
  officeArmed: false, // WORK: the next map click sets the office
  setOfficeArmed: (officeArmed) => set({ officeArmed }),
  poiCats: 'all',
  setPoiCats: (poiCats) => set({ poiCats }),
  placesOn: false,
  setPlacesOn: (placesOn) => set({ placesOn }),
  tour: null,
  setTour: (tour) => set({ tour }),
  hoods: null, // neighborhoods.json zones, loaded by the LIVE layer (P4)
  tourResume: null, // the tour a movement key interrupted, offered back for 10 s
  lineAlerts: {}, // line id → { severity, headlines } from CTA alerts (P4)
  hover: null,    // { x, y, lines } — the building under the pointer (P4)
  setHover: (hover) => set({ hover }),
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
