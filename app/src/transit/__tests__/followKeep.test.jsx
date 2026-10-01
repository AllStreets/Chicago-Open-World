// app/src/transit/__tests__/followKeep.test.jsx — C-fix (2026-10-01): M and the other feature toggles never end a
// train follow, a tour or a ride; only Esc, the movement keys and the camera commands take the camera back.
import { describe, it, expect, beforeEach } from 'vitest'
import { shouldExitFollow } from '../followCam.js'
import { handleFollowKey } from '../followKeys.js'
import { KEEP_CAMERA_CODES } from '../../lib/cameraKeepKeys.js'
import { FEATURE_CONTROLS, featureById } from '../../hud/featureControls.js'
import { featureCommands } from '../../lib/paletteSources.js'
import { useStore } from '../../state/store.js'
import { useSoundStore } from '../../audio/soundStore.js'

const ev = (code, key = '') => ({ code, key, target: document.body })
beforeEach(() => { useStore.setState(useStore.getInitialState()); useSoundStore.setState(useSoundStore.getInitialState()) })

describe('C-fix: the safe-key list', () => {
  it('feature toggles, K and ? never end a follow', () => {
    for (const [code, key] of [['KeyM', 'm'], ['KeyT', 't'], ['KeyG', 'g'], ['KeyB', 'b'], ['KeyJ', 'j'], ['KeyX', 'x'], ['KeyP', 'p'], ['KeyC', 'c'], ['KeyV', 'v'], ['KeyL', 'l'], ['KeyK', 'k'], ['Slash', '?']]) {
      expect(shouldExitFollow(ev(code, key)), code).toBe(false)
    }
  })
  it('Esc, the movement keys and Page Up still take the camera back', () => {
    for (const [code, key] of [['KeyW', 'w'], ['ArrowUp', 'ArrowUp'], ['Escape', 'Escape'], ['PageUp', 'PageUp']]) expect(shouldExitFollow(ev(code, key)), code).toBe(true)
  })
  it('every FEATURE_CONTROLS key is on the list (a new toggle cannot forget it)', () => {
    for (const c of FEATURE_CONTROLS) expect(KEEP_CAMERA_CODES.has(c.key), c.id).toBe(true)
  })
})

describe('C-fix: keys while following', () => {
  it('K cycles the follow view and keeps the follow', () => {
    useStore.getState().startFollow('t1', 'chase')
    expect(handleFollowKey(ev('KeyK', 'k'))).toBe(true)
    expect(useStore.getState().follow).toEqual({ trainId: 't1', view: 'side' })
    handleFollowKey(ev('KeyK', 'k'))
    expect(useStore.getState().follow.view).toBe('chase')
  })
  it('M keeps the follow; W ends it', () => {
    useStore.getState().startFollow('t1')
    expect(handleFollowKey(ev('KeyM', 'm'))).toBe(false)
    expect(useStore.getState().follow).not.toBeNull()
    expect(handleFollowKey(ev('KeyW', 'w'))).toBe(true)
    expect(useStore.getState().follow).toBeNull()
  })
})

describe('C-fix: X does not fly while following, touring or riding', () => {
  for (const [mode, state] of [['follow', { follow: { trainId: 't1', view: 'chase' } }], ['tour', { tour: { id: 'loop', t: 0 } }], ['ride', { ride: { id: 'glide', kind: 'glide' } }]]) {
    it(`during a ${mode}: no flight, a toast, the ${mode} unchanged`, () => {
      let asked = 0
      useStore.setState({ ...state, requestFireworksView: () => { asked++; useStore.getState().startFlight({ position: [0, 1, 0], target: [0, 0, 0] }) } })
      featureById('fireworks').toggle()
      const s = useStore.getState()
      expect(asked).toBe(0); expect(s.flight).toBeNull()
      expect(s[mode]).toEqual(state[mode])
      expect(s.toast?.text).toMatch(/Fireworks are on at Navy Pier — press X again to stop/)
    })
  }
  it('otherwise X still asks for the view of the barge', () => {
    let asked = 0
    useStore.setState({ requestFireworksView: () => { asked++ } })
    featureById('fireworks').toggle()
    expect(asked).toBe(1)
  })
})

describe('C-fix: ⌘K toggles keep the follow', () => {
  it('⌘K "Sound" with a follow set: sound on, follow kept', () => {
    useStore.getState().startFollow('t1')
    featureCommands().find((c) => c.id === 'f:sound').run()
    expect(useSoundStore.getState().soundOn).toBe(true)
    expect(useStore.getState().follow).not.toBeNull()
  })
})
