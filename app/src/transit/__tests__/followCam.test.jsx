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
