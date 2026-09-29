import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { followPose, followStep, shouldExitFollow, FOLLOW } from '../followCam.js'
import { followNearest } from '../actions.js'
import FollowChip from '../../hud/FollowChip.jsx'
import { useStore } from '../../state/store.js'
import { TRANSIT } from './fixtures.js'

const none = () => 0
describe('follow cam', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); vi.useRealTimers() })
  it('chases from behind and above, looking down the track', () => {
    expect(followPose([0, 7.2, 0], [1, 0, 0], 'chase', none)).toEqual({ position: [-38, 21.2, 0], target: [70, 9.2, 0] })
    const side = followPose([0, 7.2, 0], [1, 0, 0], 'side', none)
    expect(side.position).toEqual([4, 12.2, 26]); expect(FOLLOW.side.side).toBe(26)
  })
  it('never below clearance: over the Loop it rises above the roofs', () => {
    expect(followPose([0, 7.2, 0], [1, 0, 0], 'chase', () => 325).position[1]).toBe(325)
  })
  it('subway: camera stays on the surface', () => {
    const p = followPose([0, -9, 0], [1, 0, 0], 'chase', () => 25)
    expect(p.position[1]).toBe(25); expect(p.target[1]).toBe(2)
  })
  it('a vanished train ends following with a chip', () => {
    expect(followStep({ trainId: 'gone', view: 'chase' }, [], none)).toEqual({ ended: 'left' })
    const t = { id: 'a', head: { p: [0, 7.2, 0], dir: [0, 0, -1] } }
    expect(followStep({ trainId: 'a', view: 'chase' }, [t], none).pose.position).toEqual([0, 21.2, 38])
    useStore.getState().startFollow('a'); useStore.getState().stopFollow('left')
    render(<FollowChip />)
    expect(screen.getByText(/The train left the map/)).toBeInTheDocument()
  })
  it('any key exits except a lone modifier', () => {
    expect(shouldExitFollow({ key: 'a' })).toBe(true); expect(shouldExitFollow({ key: 'Escape' })).toBe(true)
    expect(shouldExitFollow({ key: 'ArrowUp' })).toBe(true); expect(shouldExitFollow({ key: 'Shift' })).toBe(false)
    expect(shouldExitFollow({ key: 'Meta' })).toBe(false)
  })
  it('follows the nearest running train of a line; chip offers Chase / Side / Stop', () => {
    vi.useFakeTimers({ now: new Date('2026-09-30T08:15:00-05:00'), toFake: ['Date'] })
    useStore.setState({ transit: TRANSIT, transitOn: false, hiddenLines: ['red'] })
    expect(followNearest('red')).toBe(true)
    const s = useStore.getState()
    expect(s.follow.trainId).toMatch(/^svc-r1:2026-09-30:/); expect(s.transitOn).toBe(true); expect(s.hiddenLines).toEqual([])
    render(<FollowChip />)
    fireEvent.click(screen.getByRole('button', { name: 'Side' })); expect(useStore.getState().follow.view).toBe('side')
    fireEvent.click(screen.getByRole('button', { name: 'Stop following' })); expect(useStore.getState().follow).toBeNull()
  })
})

describe('follow cam in the canyons', () => {
  const pitch = (p) => Math.atan2(p.position[1] - p.target[1], Math.hypot(p.position[0] - p.target[0], p.position[2] - p.target[2])) * 180 / Math.PI
  it('side view over a building swaps to the clear side of the track', () => {
    const rightBlocked = (x, z) => (z > 10 ? 200 : 25)
    const p = followPose([0, 7.2, 0], [1, 0, 0], 'side', rightBlocked)
    expect(p.position[2]).toBeLessThan(0); expect(p.position[1]).toBe(25)
  })
  it('both sides blocked: falls back to a chase from behind', () => {
    const sidesBlocked = (x, z) => (Math.abs(z) > 10 ? 200 : 25)
    const p = followPose([0, 7.2, 0], [1, 0, 0], 'side', sidesBlocked)
    expect(p.position[0]).toBeLessThan(-30); expect(p.position[1]).toBe(25)
  })
  it('everything blocked: lifted but pulled back, never looking straight down', () => {
    const p = followPose([0, 7.2, 0], [1, 0, 0], 'side', () => 200)
    expect(p.position[1]).toBe(200); expect(pitch(p)).toBeLessThanOrEqual(46)
  })
  it('prefers an elevated train to a nearer one in the subway', async () => {
    const { pickTrain } = await import('../actions.js')
    const sub = { id: 's', head: { p: [10, -9, 0] } }, el = { id: 'e', head: { p: [600, 7, 0] } }
    expect(pickTrain([sub, el], [0, 0]).id).toBe('e')
    expect(pickTrain([sub], [0, 0]).id).toBe('s')
    expect(pickTrain([], [0, 0])).toBeUndefined()
  })
})

describe('follow cam and the length of the train', () => {
  const cars = [{ length: 15 }, { length: 15 }, null]
  it('chase sits behind the last car, not above the middle of the train', () => {
    const t = { id: 'a', head: { p: [0, 7.2, 0], dir: [1, 0, 0] }, cars }
    expect(followStep({ trainId: 'a', view: 'chase' }, [t], none).pose.position[0]).toBe(-68)
  })
  it('side view frames the leading car whatever the length', () => {
    const t = { id: 'a', head: { p: [0, 7.2, 0], dir: [1, 0, 0] }, cars }
    const p = followStep({ trainId: 'a', view: 'side' }, [t], none).pose
    expect(p.target[0]).toBe(0); expect(p.position[0]).toBe(4)
  })
})
