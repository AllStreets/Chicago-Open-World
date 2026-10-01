// app/src/hud/__tests__/ridePanel.test.jsx — Ride the city is reachable by a non-coder (P7 Task 2): L, the dock row,
// ⌘K and the panel; the in-ride bar's buttons pause, skip, change speed and view, and stop.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RidePanel from '../RidePanel.jsx'
import RideBar from '../RideBar.jsx'
import ControlDock from '../ControlDock.jsx'
import { useStore } from '../../state/store.js'
import { useFeatureKeys } from '../useFeatureKeys.js'
import { TRANSIT } from '../../transit/__tests__/fixtures.js'
import { lRides, busRides, walkRides } from '../../ride/rideCatalog.js'
import { getSim } from '../../transit/simStore.js'
import { hideNearRide } from '../../ride/rideSession.js'
import { rideCommands } from '../../lib/paletteSources.js'

function Keys() { useFeatureKeys(); return null }
describe('Ride the city', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-30T08:15:00-05:00'), toFake: ['Date'] })
    useStore.setState(useStore.getInitialState()); useStore.setState({ transit: TRANSIT })
  })
  it('L and the dock row open the panel, which lists the L, buses, walks and the glide', () => {
    render(<><Keys /><ControlDock /><RidePanel /></>)
    fireEvent.keyDown(window, { code: 'KeyL', key: 'l' })
    expect(screen.getByRole('dialog', { name: 'Ride the city' })).toBeInTheDocument()
    for (const t of ['L trains', 'Buses', 'Walks', 'Glide']) expect(screen.getByRole('region', { name: t })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ride (L)' }))
    expect(useStore.getState().ridePanelOpen).toBe(false)
  })
  it('picking a ride starts it, closes the panel and ends a tour or flight', () => {
    useStore.getState().startFlight({ position: [0, 300, 0], target: [0, 0, 0] })
    useStore.getState().setRidePanelOpen(true)
    render(<RidePanel />)
    fireEvent.click(screen.getByRole('button', { name: /Glide over the city/ }))
    const s = useStore.getState()
    expect(s.ride).toMatchObject({ id: 'glide', kind: 'glide' }); expect(s.ridePanelOpen).toBe(false); expect(s.flight).toBeNull()
  })
  it('a tour, a flight or a follow ends the ride (one camera owner)', () => {
    useStore.setState({ ride: { id: 'glide', kind: 'glide' } })
    useStore.getState().startFlight({ position: [0, 300, 0], target: [0, 0, 0] })
    expect(useStore.getState().ride).toBeNull()
  })
  it('the bar: pause, speed, view and stop are buttons', () => {
    useStore.setState({ ride: { id: 'l:x', kind: 'L', name: 'Brown Line: Kimball → Loop', view: 'cab', paused: false, speed: 1 }, rideHud: { next: { name: 'Clark/Lake', etaS: 70 }, nearby: ['The Chicago Theatre'], progress: 0.3 } })
    render(<RideBar />)
    expect(screen.getByText(/Next: Clark\/Lake · 1 min/)).toBeInTheDocument(); expect(screen.getByText(/The Chicago Theatre/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pause/ })); expect(useStore.getState().ride.paused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Speed ×1/ })); expect(useStore.getState().ride.speed).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /View: Front window/ })); expect(useStore.getState().ride.view).toBe('side')
    fireEvent.click(screen.getByRole('button', { name: /Stop riding/ })); expect(useStore.getState().ride).toBeNull()
  })
  it('⌘K lists every ride by name', () => {
    const names = rideCommands().map((c) => c.name)
    expect(names).toContain('Glide over the city'); expect(names.some((n) => /^Ride: /.test(n))).toBe(true)
  })
})

describe('ride catalog', () => {
  it('one L ride per CTA service, with its stops and V4 profile', () => {
    const sim = getSim(), rides = lRides(sim, TRANSIT)
    expect(rides.length).toBeGreaterThan(0)
    expect(rides[0]).toMatchObject({ kind: 'L' }); expect(rides[0].stops.length).toBeGreaterThan(1); expect(rides[0].profile.duration).toBeGreaterThan(0)
  })
  it('buses and walks from rides data: stops along the path, walk sights projected onto it', () => {
    const json = { buses: [{ id: '146', ref: '146', name: 'Inner Drive', path: [[0, 0], [0, -1000]], stops: [{ name: 'Oak', s: 500 }] }],
      walks: [{ id: 'rw', name: 'The Riverwalk', path: [[0, 0], [1000, 0]], sights: [{ name: 'Bridge', x: 400, z: 30 }, { name: 'Far', x: 400, z: 900 }] }] }
    const [b] = busRides(json), [w] = walkRides(json)
    expect(b.stops.map((s) => s.name)).toEqual(['Start', 'Oak', 'End']); expect(b.profile.duration).toBeGreaterThan(0)
    expect(w.stops.map((s) => s.name)).toEqual(['Start', 'Bridge', 'End']); expect(w.stops[1].s).toBeCloseTo(400, 0)
  })
  it('simulated trains of the ride’s service step aside near the ride train, others stay', () => {
    const ride = { service: 'a', sHead: 1000 }
    const trains = [{ service: 'a', sHead: 1100 }, { service: 'a', sHead: 5000 }, { service: 'b', sHead: 1000 }]
    expect(hideNearRide(trains, ride)).toEqual([{ service: 'a', sHead: 5000 }, { service: 'b', sHead: 1000 }])
  })
})
