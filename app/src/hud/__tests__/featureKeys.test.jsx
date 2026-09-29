// app/src/hud/__tests__/featureKeys.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Hud from '../Hud.jsx'
import { featureForKey } from '../useFeatureKeys.js'
import { featureById } from '../featureControls.js'
import { useStore } from '../../state/store.js'

describe('feature keys', () => {
  beforeEach(() => useStore.setState({ ...useStore.getInitialState(), transit: { lines: [], routes: [], stations: [] } }))
  it('maps T, G, M, B, J by physical key; ignores chords', () => {
    expect(featureForKey({ code: 'KeyT', target: document.body }).id).toBe('transit')
    expect(featureForKey({ code: 'KeyG', target: document.body }).id).toBe('games')
    expect(featureForKey({ code: 'KeyM', target: document.body }).id).toBe('sound')
    expect(featureForKey({ code: 'KeyB', target: document.body }).id).toBe('bridges')
    expect(featureForKey({ code: 'KeyJ', target: document.body }).id).toBe('fountain')
    expect(featureForKey({ code: 'KeyT', metaKey: true, target: document.body })).toBeNull()
    expect(featureForKey({ code: 'KeyX', target: document.body })).toBeNull()
  })
  it('typing in an input never toggles a feature', () => {
    const input = document.createElement('input')
    expect(featureForKey({ code: 'KeyT', target: input })).toBeNull()
    const ta = document.createElement('textarea')
    expect(featureForKey({ code: 'KeyG', target: ta })).toBeNull()
    const div = document.createElement('div'); div.contentEditable = 'true'
    expect(featureForKey({ code: 'KeyM', target: div })).toBeNull()
    useStore.setState({ paletteOpen: true })
    expect(featureForKey({ code: 'KeyT', target: document.body })).toBeNull()
  })
  it('an unavailable feature ignores its key', () => {
    useStore.setState({ transit: null })
    expect(featureForKey({ code: 'KeyT', target: document.body })).toBeNull()
  })
  it('one key press toggles exactly once in the full HUD', () => {
    render(<Hud />)
    for (const [code, id] of [['KeyT', 'transit'], ['KeyG', 'games'], ['KeyM', 'sound'], ['KeyB', 'bridges'], ['KeyJ', 'fountain']]) {
      const f = featureById(id), was = f.isOn()
      fireEvent.keyDown(window, { code, key: code.slice(3).toLowerCase() })
      expect(f.isOn(), id).toBe(!was)
    }
  })
})
