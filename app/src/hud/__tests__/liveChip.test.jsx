// app/src/hud/__tests__/liveChip.test.jsx — the honest LIVE CTA / SIMULATED chip and its sources popover (P5 Task 1).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LiveChip from '../LiveChip.jsx'
import { useStore } from '../../state/store.js'

describe('LIVE / SIMULATED chip', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('reads SIMULATED by default and LIVE CTA when the CTA feed is live', () => {
    const { rerender } = render(<LiveChip />)
    expect(screen.getByText('SIMULATED')).toBeInTheDocument()
    useStore.getState().setFeed('cta', 'LIVE'); rerender(<LiveChip />)
    expect(screen.getByText('LIVE CTA')).toBeInTheDocument()
  })
  it('opens a plain-words data sources popover with a retry button', () => {
    render(<LiveChip />)
    fireEvent.click(screen.getByRole('button', { name: /data sources/i }))
    expect(screen.getByText(/^Trains/)).toBeInTheDocument()
    expect(screen.getByText(/^Weather/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try live again/i })).toBeInTheDocument()
  })
  it('the store opens it too (⌘K "Data: show sources")', async () => {
    render(<LiveChip />)
    expect(screen.queryByRole('dialog', { name: /data sources/i })).toBeNull()
    useStore.getState().setSourcesOpen(true)
    expect(await screen.findByRole('dialog', { name: /data sources/i })).toBeInTheDocument()
  })
})
