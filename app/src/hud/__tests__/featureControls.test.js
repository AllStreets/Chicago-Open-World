// app/src/hud/__tests__/featureControls.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { FEATURE_CONTROLS, featureById } from '../featureControls.js'
import { useStore } from '../../state/store.js'
import { useSoundStore } from '../../audio/soundStore.js'
import { useSports } from '../../sports/sportsStore.js'
import { DOCK_FEATURES } from '../featureControls.js'

describe('feature controls registry', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSoundStore.setState(useSoundStore.getInitialState()); useSports.setState(useSports.getInitialState()) })
  it('lists Transit, Games, Sound, Bridges, Fountain, Fireworks, Places, Traffic, Scan, Ride and Play with unique keys and every path filled in', () => {
    expect(FEATURE_CONTROLS.map((c) => c.id)).toEqual(['transit', 'games', 'sound', 'bridges', 'fountain', 'fireworks', 'places', 'traffic', 'scan', 'ride', 'showcase'])
    expect(new Set(FEATURE_CONTROLS.map((c) => c.key)).size).toBe(FEATURE_CONTROLS.length)
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
  it('traffic is on by default, on C, and waits for its road graph', () => {
    const c = featureById('traffic')
    expect(c.key).toBe('KeyC'); expect(c.isOn()).toBe(true)
    useStore.setState({ manifest: null }); expect(c.available()).toBe(false)
    useStore.setState({ manifest: { traffic: 'traffic.bin' } }); expect(c.available()).toBe(true)
  })
  it('transit is unavailable until its data loads', () => {
    useStore.setState({ transit: null })
    expect(featureById('transit').available()).toBe(false)
    useStore.setState({ transit: { lines: [] } })
    expect(featureById('transit').available()).toBe(true)
  })
})

// E4-4: "Play a game" on Y, ⌘K and the help card — not a dock button (the dock stays at six)
describe('Play a game (showcase) control', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState()) })
  it('is on Y and not in the dock, which is unchanged', () => {
    const c = featureById('showcase')
    expect(c.key).toBe('KeyY'); expect(c.keyLabel).toBe('Y')
    expect(DOCK_FEATURES.map((d) => d.id)).toEqual(['transit', 'games', 'places', 'bridges', 'fountain', 'fireworks'])
  })
  it('Y plays at the ballpark whose card is open, else the nearest to where you look; Y again stops', () => {
    const v = (key, center) => ({ key, name: key, center, teams: [], radius: 100 })
    useSports.setState({ venues: [v('wrigleyfield', [-2300, -7349]), v('ratefield', [-486, 5796]), v('soldierfield', [923, 2164])] })
    useStore.setState({ readout: { x: 900, z: 2100 } })
    featureById('showcase').toggle()
    expect(useSports.getState().showcase).toMatchObject({ venueKey: 'soldierfield', team: 'bears' })
    featureById('showcase').toggle()
    expect(useSports.getState().showcase).toBeNull()
    useSports.setState({ cardVenue: 'ratefield' })
    featureById('showcase').toggle()
    expect(useSports.getState().showcase).toMatchObject({ venueKey: 'ratefield', team: 'whitesox' })
  })
  it('a real live game is never overridden from Y', () => {
    useSports.setState({ venues: [{ key: 'wrigleyfield', name: 'Wrigley Field', center: [0, 0] }], cardVenue: 'wrigleyfield', states: { wrigleyfield: { state: 'live', game: { id: 'real' } } } })
    featureById('showcase').toggle()
    expect(useSports.getState().showcase).toBeNull()
    expect(useStore.getState().toast.text).toMatch(/real game is on/)
  })
})
