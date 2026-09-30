// app/src/hud/__tests__/perfOverlay.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PerfOverlay from '../PerfOverlay.jsx'
import CommandPalette from '../CommandPalette.jsx'
import { useStore } from '../../state/store.js'

describe('perf chip', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('hidden by default; shows draw calls, triangles and fps when on', () => {
    const { rerender, container } = render(<PerfOverlay />)
    expect(container.firstChild).toBeNull()
    useStore.setState({ perfOn: true, perf: { calls: 812, maxCalls: 830, triangles: 2_140_000, fps: 60, frames: 60 } })
    rerender(<PerfOverlay />)
    expect(screen.getByRole('status')).toHaveTextContent('812 DRAW · 2.1M TRIS · 60 FPS')
  })
  it('⌘K "performance" turns it on (human-first; no URL needed)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'performance' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().perfOn).toBe(true)
  })
})
