// app/src/hud/placePopup.js — which place's popup is open (a small store of its own, so the popup stays independent of
// the guide's selection and context panel).
import { create } from 'zustand'

export const usePlacePopup = create((set) => ({
  poi: null,
  closedAt: 0,
  open: (poi) => set({ poi }),
  close: () => set((s) => (s.poi ? { poi: null, closedAt: Date.now() } : {})),
}))
