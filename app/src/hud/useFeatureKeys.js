// app/src/hud/useFeatureKeys.js — T / G / M / B / J reach Transit, Games, Sound, Bridges and Fountain;
// never while typing, searching or holding a modifier, and never for a feature whose data has not loaded.
import { useEffect } from 'react'
import { FEATURE_CONTROLS } from './featureControls.js'
import { useStore } from '../state/store.js'

export function featureForKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  const t = e.target
  if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable || t.contentEditable === 'true')) return null
  if (useStore.getState().paletteOpen) return null
  const c = FEATURE_CONTROLS.find((x) => x.key === e.code)
  return c && c.available() ? c : null
}

export function useFeatureKeys() {
  useEffect(() => {
    const on = (e) => { if (e.repeat) return; const c = featureForKey(e); if (c) c.toggle() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}
