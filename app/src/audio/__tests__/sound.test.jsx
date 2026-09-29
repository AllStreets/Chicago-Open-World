import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSoundStore, soundStore, getAudioContext } from '../soundStore.js'
import { rumbleLevel, clatterHz, createRumble } from '../rumble.js'
import ControlDock from '../../hud/ControlDock.jsx'
import { useStore } from '../../state/store.js'

describe('sound', () => {
  beforeEach(() => { useSoundStore.setState({ soundOn: false }); useStore.setState(useStore.getInitialState()) })
  it('no AudioContext: toggles, never throws; off by default', () => {
    expect(useSoundStore.getState().soundOn).toBe(false); expect(soundStore).toBe(useSoundStore)
    expect(() => useSoundStore.getState().setSoundOn(true)).not.toThrow()
    expect(useSoundStore.getState().soundOn).toBe(true); expect(getAudioContext()).toBeNull()
    useSoundStore.getState().toggleSound(); expect(useSoundStore.getState().soundOn).toBe(false)
  })
  it('rumble: louder near and fast; silent when stopped or invalid', () => {
    expect(rumbleLevel(10, 20)).toBeGreaterThan(rumbleLevel(100, 20)); expect(rumbleLevel(10, 20)).toBeLessThanOrEqual(1)
    expect(rumbleLevel(10, 20)).toBeGreaterThan(rumbleLevel(10, 5))
    expect(rumbleLevel(10, 0)).toBe(0); expect(rumbleLevel(NaN, 10)).toBe(0); expect(rumbleLevel(10, NaN)).toBe(0)
    expect(clatterHz(14.63)).toBeCloseTo(2, 6); expect(clatterHz(0)).toBe(0)
  })
  it('createRumble drives a context and stops cleanly', () => {
    const param = () => ({ value: 0, setTargetAtTime: vi.fn() })
    const node = () => ({ connect: vi.fn((n) => n), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: param(), gain: param(), Q: param(), type: '', buffer: null, loop: false })
    const gains = []
    const ctx = { sampleRate: 8000, currentTime: 0, destination: node(), createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
      createBufferSource: node, createBiquadFilter: node, createOscillator: node, createGain: () => { const g = node(); gains.push(g); return g } }
    const r = createRumble(ctx)
    r.set(0.5, 2)
    expect(gains.some((g) => g.gain.setTargetAtTime.mock.calls.length > 0)).toBe(true)
    expect(() => r.stop()).not.toThrow()
  })
  it('the dock has a Sound button, off until pressed', () => {
    render(<ControlDock />)
    const b = screen.getByRole('button', { name: 'Sound: off' })
    expect(b).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(b)
    expect(screen.getByRole('button', { name: 'Sound: on' })).toHaveAttribute('aria-pressed', 'true')
  })
})
