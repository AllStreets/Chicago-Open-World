// app/src/hud/__tests__/featureControls.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { FEATURE_CONTROLS, featureById } from '../featureControls.js'
import { useStore } from '../../state/store.js'
import { useSoundStore } from '../../audio/soundStore.js'

describe('feature controls registry', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSoundStore.setState(useSoundStore.getInitialState()) })
  it('lists Transit, Games, Sound, Bridges and Fountain with unique keys and every path filled in', () => {
    expect(FEATURE_CONTROLS.map((c) => c.id)).toEqual(['transit', 'games', 'sound', 'bridges', 'fountain'])
    expect(new Set(FEATURE_CONTROLS.map((c) => c.key)).size).toBe(5)
    for (const c of FEATURE_CONTROLS) {
      expect(c.label).toMatch(/^[A-Z][a-z]+$/)
      expect(c.keyLabel).toHaveLength(1)
      expect(c.help.length).toBeGreaterThan(10)
      expect(c.hint.length).toBeGreaterThan(2)
      expect(typeof c.icon).toBe('function')
    }
  })
  it('toggle flips the real state and isOn reads it', () => {
    for (const c of FEATURE_CONTROLS) {
      const before = c.isOn()
      c.toggle()
      expect(c.isOn(), c.id).toBe(!before)
      c.toggle()
      expect(c.isOn(), c.id).toBe(before)
    }
  })
  it('sound starts off (browsers block autoplay; nobody is surprised by noise)', () => {
    expect(featureById('sound').isOn()).toBe(false)
  })
  it('transit is unavailable until its data loads', () => {
    useStore.setState({ transit: null })
    expect(featureById('transit').available()).toBe(false)
    useStore.setState({ transit: { lines: [] } })
    expect(featureById('transit').available()).toBe(true)
  })
})
