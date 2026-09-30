import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store.js'

describe('store', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('defaults to LIVE time and FLY camera', () => {
    expect(useStore.getState().timePreset).toBe('LIVE')
    expect(useStore.getState().cameraMode).toBe('FLY')
  })
  it('tracks load progress to ready', () => {
    const s = useStore.getState()
    s.setLoadTotal(2); s.markLoaded('a'); s.markLoaded('a')
    expect(useStore.getState().load).toMatchObject({ done: 1, ready: false })
    s.markLoaded('b')
    expect(useStore.getState().load).toMatchObject({ done: 2, ready: true })
  })
  it('an error still resolves ready so the app never hangs', () => {
    useStore.getState().setLoadTotal(3)
    useStore.getState().setLoadError('manifest 404')
    expect(useStore.getState().load).toMatchObject({ ready: true, error: 'manifest 404' })
  })
  it('quality defaults to HIGH and can be set', () => {
    expect(useStore.getState().quality).toBe('HIGH')
    useStore.getState().setQuality('LOW')
    expect(useStore.getState().quality).toBe('LOW')
  })
  it('intro runs once until finished', () => {
    expect(useStore.getState().introDone).toBe(false)
    useStore.getState().finishIntro()
    expect(useStore.getState().introDone).toBe(true)
  })
  it('flights, palette, help and camera commands', () => {
    const s = useStore.getState()
    s.startFlight({ position: [1, 2, 3], target: [0, 0, 0] })
    expect(useStore.getState().flight.to.position).toEqual([1, 2, 3])
    s.clearFlight(); expect(useStore.getState().flight).toBeNull()
    s.setPaletteOpen(true); expect(useStore.getState().paletteOpen).toBe(true)
    s.setHelpOpen(true); expect(useStore.getState().helpOpen).toBe(true)
    s.camCommand('zoom', 1)
    expect(useStore.getState().cam).toMatchObject({ type: 'zoom', amount: 1 })
  })
  it('transit: data, on/off, per-line visibility', () => {
    const s = useStore.getState()
    expect(s.transit).toBeNull(); expect(s.transitOn).toBe(true); expect(s.hiddenLines).toEqual([])
    s.setTransit({ lines: [] }); expect(useStore.getState().transit).toEqual({ lines: [] })
    s.toggleLine('red'); expect(useStore.getState().hiddenLines).toEqual(['red'])
    s.toggleLine('red'); expect(useStore.getState().hiddenLines).toEqual([])
    s.toggleTransit(); expect(useStore.getState().transitOn).toBe(false)
    s.setTransitOn(true); expect(useStore.getState().transitOn).toBe(true)
    s.setHiddenLines(['a', 'b']); expect(useStore.getState().hiddenLines).toEqual(['a', 'b'])
  })
})

describe('games panel flag (V7 contract)', () => {
  it('gamesOpen starts false and setGamesOpen toggles it', () => {
    useStore.setState(useStore.getInitialState())
    expect(useStore.getState().gamesOpen).toBe(false)
    useStore.getState().setGamesOpen(true)
    expect(useStore.getState().gamesOpen).toBe(true)
  })
})

describe('guide state (P4)', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('lens, selection and office transitions', () => {
    const s = useStore.getState()
    s.setLens('WORK'); expect(useStore.getState().lens).toBe('WORK')
    s.setLens('WORK'); expect(useStore.getState().lens).toBeNull()
    s.select({ kind: 'poi', id: 'n1' }); expect(useStore.getState().selection.id).toBe('n1')
    s.clearSelection(); expect(useStore.getState().selection).toBeNull()
    s.setOffice({ x: -700, z: 400, label: '233 S WACKER' }); expect(useStore.getState().office.label).toBe('233 S WACKER')
  })
  it('places are off by default, every category on, no tour', () => {
    const g = useStore.getState()
    expect(g.placesOn).toBe(false); expect(g.poiCats).toBe('all'); expect(g.tour).toBeNull()
  })
})
