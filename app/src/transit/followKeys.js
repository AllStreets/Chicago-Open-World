// app/src/transit/followKeys.js — a key while following a train (C-fix, 2026-10-01): K changes the view (chase ↔ side,
// the same key as in a ride); Esc, a movement key or a camera command stops following; everything else (M, X, T, …)
// leaves the follow alone. True when the key was used up here.
import { useStore } from '../state/store.js'
import { shouldExitFollow } from './followCam.js'

export const nextFollowView = (view) => (view === 'chase' ? 'side' : 'chase')

export function handleFollowKey(e) {
  const s = useStore.getState()
  if (!s.follow) return false
  if (e.code === 'KeyK') { s.setFollowView(nextFollowView(s.follow.view)); return true }
  if (shouldExitFollow(e)) { s.stopFollow(); return true }
  return false
}
