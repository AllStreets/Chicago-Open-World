// app/src/sports/teamLightsStore.js — the Team lights switch (on by default, remembered), the ⌘K preview, and what
// the skyline shows now (`lit`, kept current by TeamLights.jsx for the HUD).
import { create } from 'zustand'
import { loadLightsOn, saveLightsOn, PREVIEW_MS } from './teamLights.js'

export const useTeamLights = create((set) => ({
  on: loadLightsOn(),
  setOn: (on) => { saveLightsOn(on); set(on ? { on } : { on, preview: null }) },
  preview: null, // { team, until }
  startPreview: (team, nowMs = Date.now()) => set({ preview: { team, until: nowMs + PREVIEW_MS } }),
  stopPreview: () => set({ preview: null }),
  lit: null,
  setLit: (lit) => set({ lit }),
}))
